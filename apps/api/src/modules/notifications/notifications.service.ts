import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type {
  Notification,
  NotificationChannel,
  NotificationEventPreference,
  NotificationPreference,
} from '@prisma/client';
import { AuditEventEmitterService } from '../audit/audit-event-emitter.service';
import { PrismaService } from '../../prisma.service';
import { QueueService } from '../queue/queue.service';
import { NotificationTemplateEngine } from './notification-template.engine';
import {
  resolveTemplate,
  type NotificationChannelKey,
} from './templates/registry';
import { SystemSettingsService } from './system-settings.service';

const ALL_CHANNELS: NotificationChannel[] = ['EMAIL', 'IN_APP', 'WHATSAPP', 'TELEGRAM'];

const CHANNEL_TO_KEY: Record<NotificationChannel, NotificationChannelKey> = {
  EMAIL: 'email',
  IN_APP: 'inApp',
  WHATSAPP: 'whatsapp',
  TELEGRAM: 'telegram',
};

export interface DispatchInput {
  userId: string;
  eventType: string;
  variables: Record<string, unknown>;
  channels?: NotificationChannel[];
  title?: string;
  body?: string;
  payload?: Record<string, unknown>;
}

/**
 * Task 255: Event-driven notification engine.
 *
 * Resolves the effective channel set for a user (per-event override, global
 * preferences, admin kill-switches), persists a row per channel in PENDING,
 * and enqueues one worker job per row via the notifications queue
 * (Tasks 261/262 — retry + backoff configured on the queue).
 */
@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly prismaService: PrismaService,
    private readonly queueService: QueueService,
    private readonly templateEngine: NotificationTemplateEngine,
    private readonly auditEventEmitter: AuditEventEmitterService,
    private readonly systemSettingsService: SystemSettingsService,
  ) {}

  async dispatch(input: DispatchInput): Promise<Notification[]> {
    const channels = await this.resolveChannels(input);
    if (channels.length === 0) {
      this.logger.log(`Event ${input.eventType} for user ${input.userId} has no enabled channels`);
      return [];
    }

    const created: Notification[] = [];
    for (const channel of channels) {
      const rendered = this.renderForChannel(
        input.eventType,
        channel,
        input.variables,
        input.title,
        input.body,
      );

      const notification = await this.prismaService.notification.create({
        data: {
          userId: input.userId,
          eventType: input.eventType,
          channel,
          title: rendered.title,
          body: rendered.body,
          templateKey: input.eventType,
          payload: input.payload
            ? (JSON.parse(JSON.stringify(input.payload)) as Prisma.InputJsonValue)
            : Prisma.JsonNull,
          status: 'PENDING',
        },
      });
      created.push(notification);

      await this.queueService.enqueueNotificationJob({
        notificationId: notification.id,
        userId: input.userId,
        channel,
        eventType: input.eventType,
      });

      await this.prismaService.notification.update({
        where: { id: notification.id },
        data: { status: 'QUEUED' },
      });
    }

    this.auditEventEmitter.emit({
      eventType: `notifications.dispatched.${input.eventType}`,
      category: 'notifications',
      actorType: 'SYSTEM',
      entityType: 'user',
      entityId: input.userId,
      metadata: {
        channels: channels.map((channel) => channel.toString()),
        count: created.length,
      },
    });

    return created;
  }

  async listForUser(
    userId: string,
    options: { cursor?: string; limit?: number } = {},
  ): Promise<{ items: Notification[]; nextCursor: string | null }> {
    const limit = Math.min(Math.max(options.limit ?? 20, 1), 100);
    const items = await this.prismaService.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit + 1,
      ...(options.cursor
        ? { cursor: { id: options.cursor }, skip: 1 }
        : {}),
    });

    const nextCursor = items.length > limit ? items[limit - 1].id : null;
    return { items: items.slice(0, limit), nextCursor };
  }

  async countUnreadForUser(userId: string): Promise<number> {
    return this.prismaService.notification.count({
      where: {
        userId,
        channel: 'IN_APP',
        readAt: null,
      },
    });
  }

  async markRead(userId: string, notificationId: string): Promise<Notification> {
    const existing = await this.prismaService.notification.findUnique({
      where: { id: notificationId },
    });
    if (!existing || existing.userId !== userId) {
      throw new NotFoundException('Notification not found');
    }
    if (existing.readAt) {
      return existing;
    }

    const updated = await this.prismaService.notification.update({
      where: { id: notificationId },
      data: { readAt: new Date(), status: 'READ' },
    });

    this.auditEventEmitter.emit({
      eventType: 'notifications.read',
      category: 'notifications',
      actorUserId: userId,
      entityType: 'notification',
      entityId: notificationId,
      metadata: { eventType: existing.eventType, channel: existing.channel },
    });

    return updated;
  }

  async markSent(
    notificationId: string,
    providerMessageId: string | null,
    attemptCount: number,
  ): Promise<void> {
    await this.prismaService.notification.update({
      where: { id: notificationId },
      data: {
        status: 'SENT',
        sentAt: new Date(),
        providerMessageId,
        attemptCount,
      },
    });
  }

  async markFailed(
    notificationId: string,
    error: string,
    attemptCount: number,
  ): Promise<void> {
    await this.prismaService.notification.update({
      where: { id: notificationId },
      data: {
        status: 'FAILED',
        failedAt: new Date(),
        lastError: error.slice(0, 1000),
        attemptCount,
      },
    });
  }

  async incrementAttempt(notificationId: string, attemptCount: number): Promise<void> {
    await this.prismaService.notification.update({
      where: { id: notificationId },
      data: { attemptCount },
    });
  }

  private async resolveChannels(input: DispatchInput): Promise<NotificationChannel[]> {
    const requested = input.channels && input.channels.length > 0 ? input.channels : ALL_CHANNELS;

    const [globalPref, eventPref, adminDisabled] = await Promise.all([
      this.prismaService.notificationPreference.findUnique({
        where: { userId: input.userId },
      }),
      this.prismaService.notificationEventPreference.findUnique({
        where: { userId_eventType: { userId: input.userId, eventType: input.eventType } },
      }),
      this.systemSettingsService.getDisabledChannels(),
    ]);

    const result: NotificationChannel[] = [];
    for (const channel of requested) {
      if (adminDisabled.has(channel)) continue;
      if (!this.isChannelEnabled(channel, globalPref, eventPref)) continue;
      result.push(channel);
    }
    return result;
  }

  private isChannelEnabled(
    channel: NotificationChannel,
    globalPref: NotificationPreference | null,
    eventPref: NotificationEventPreference | null,
  ): boolean {
    if (eventPref) {
      const enabled = this.parseEnabledChannels(eventPref.enabledChannels);
      return enabled.has(channel);
    }
    if (!globalPref) {
      // Default: only IN_APP until user sets preferences.
      return channel === 'IN_APP';
    }
    switch (channel) {
      case 'EMAIL':
        return globalPref.emailEnabled;
      case 'IN_APP':
        return globalPref.inAppEnabled;
      case 'WHATSAPP':
        return globalPref.whatsappEnabled;
      case 'TELEGRAM':
        return globalPref.telegramEnabled;
      default:
        return false;
    }
  }

  private parseEnabledChannels(value: Prisma.JsonValue): Set<NotificationChannel> {
    if (!Array.isArray(value)) return new Set();
    const result = new Set<NotificationChannel>();
    for (const entry of value) {
      if (typeof entry === 'string' && ALL_CHANNELS.includes(entry as NotificationChannel)) {
        result.add(entry as NotificationChannel);
      }
    }
    return result;
  }

  private renderForChannel(
    eventType: string,
    channel: NotificationChannel,
    variables: Record<string, unknown>,
    overrideTitle?: string,
    overrideBody?: string,
  ): { title: string; body: string } {
    if (overrideTitle && overrideBody) {
      return { title: overrideTitle, body: overrideBody };
    }
    const template = resolveTemplate(eventType, CHANNEL_TO_KEY[channel]);
    const rendered = this.templateEngine.render(template, variables);
    return {
      title: overrideTitle ?? rendered.subject ?? eventType,
      body: overrideBody ?? rendered.body,
    };
  }
}
