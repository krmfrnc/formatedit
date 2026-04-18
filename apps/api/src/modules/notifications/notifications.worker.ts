import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import type { Job, Worker } from 'bullmq';
import type { NotificationChannel } from '@prisma/client';
import { PrismaService } from '../../prisma.service';
import { QueueService } from '../queue/queue.service';
import type { NotificationJobPayload } from '../queue/queue.types';
import { EmailChannelAdapter } from './adapters/email.adapter';
import { InAppChannelAdapter } from './adapters/inapp.adapter';
import { TelegramChannelAdapter } from './adapters/telegram.adapter';
import { WhatsAppChannelAdapter } from './adapters/whatsapp.adapter';
import type { ChannelAdapter } from './adapters/channel-adapter.interface';
import { NotificationsService } from './notifications.service';

/**
 * Task 261/262: BullMQ worker that pulls notification jobs off the queue and
 * routes them to the configured channel adapter. On failure the underlying
 * queue retry policy (5 attempts, exponential backoff) retries automatically;
 * once attempts are exhausted the notification is marked FAILED.
 */
@Injectable()
export class NotificationsWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(NotificationsWorker.name);
  private worker: Worker<NotificationJobPayload> | null = null;
  private readonly adapters: Record<NotificationChannel, ChannelAdapter>;

  constructor(
    private readonly prismaService: PrismaService,
    private readonly queueService: QueueService,
    private readonly notificationsService: NotificationsService,
    emailAdapter: EmailChannelAdapter,
    inAppAdapter: InAppChannelAdapter,
    whatsappAdapter: WhatsAppChannelAdapter,
    telegramAdapter: TelegramChannelAdapter,
  ) {
    this.adapters = {
      EMAIL: emailAdapter,
      IN_APP: inAppAdapter,
      WHATSAPP: whatsappAdapter,
      TELEGRAM: telegramAdapter,
    };
  }

  onModuleInit(): void {
    if (process.env.NODE_ENV === 'test' || process.env.NOTIFICATIONS_WORKER_DISABLED === '1') {
      this.logger.log('Notifications worker disabled by environment');
      return;
    }
    this.worker = this.queueService.createNotificationsWorker((job) => this.process(job));
    this.worker.on('failed', (job, error) => {
      if (!job) return;
      const attemptsMade = job.attemptsMade ?? 0;
      const maxAttempts = job.opts.attempts ?? 5;
      if (attemptsMade >= maxAttempts) {
        const message = error?.message ?? 'unknown error';
        void this.notificationsService.markFailed(
          job.data.notificationId,
          message,
          attemptsMade,
        );
      }
    });
  }

  async onModuleDestroy(): Promise<void> {
    if (this.worker) {
      await this.worker.close();
    }
  }

  private async process(job: Job<NotificationJobPayload>): Promise<void> {
    const attempt = job.attemptsMade + 1;
    const notification = await this.prismaService.notification.findUnique({
      where: { id: job.data.notificationId },
    });
    if (!notification) {
      this.logger.warn(`Notification ${job.data.notificationId} disappeared`);
      return;
    }
    if (notification.status === 'SENT' || notification.status === 'READ') {
      return;
    }

    const user = await this.prismaService.user.findUnique({
      where: { id: job.data.userId },
    });
    if (!user) {
      await this.notificationsService.markFailed(
        notification.id,
        'User not found',
        attempt,
      );
      return;
    }

    await this.notificationsService.incrementAttempt(notification.id, attempt);

    const adapter = this.adapters[notification.channel];
    const result = await adapter.send(notification, user);
    await this.notificationsService.markSent(
      notification.id,
      result.providerMessageId,
      attempt,
    );
  }
}
