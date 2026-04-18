import { Injectable } from '@nestjs/common';
import type {
  NotificationEventPreference,
  NotificationPreference,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../../prisma.service';
import type {
  UpdateEventPreferenceInput,
  UpdateGlobalPreferencesInput,
} from './schemas/update-preferences.schema';

/**
 * Task 260: CRUD for the per-user channel preferences. Two layers: the global
 * `NotificationPreference` row (channel-level on/off) and per-event overrides
 * stored in `NotificationEventPreference`.
 */
@Injectable()
export class NotificationPreferencesService {
  constructor(private readonly prismaService: PrismaService) {}

  async getForUser(userId: string): Promise<{
    global: NotificationPreference;
    events: NotificationEventPreference[];
  }> {
    const [global, events] = await Promise.all([
      this.prismaService.notificationPreference.upsert({
        where: { userId },
        create: { userId },
        update: {},
      }),
      this.prismaService.notificationEventPreference.findMany({
        where: { userId },
        orderBy: { eventType: 'asc' },
      }),
    ]);
    return { global, events };
  }

  async updateGlobal(
    userId: string,
    input: UpdateGlobalPreferencesInput,
  ): Promise<NotificationPreference> {
    return this.prismaService.notificationPreference.upsert({
      where: { userId },
      create: { userId, ...input },
      update: input,
    });
  }

  async upsertEventPreference(
    userId: string,
    eventType: string,
    input: UpdateEventPreferenceInput,
  ): Promise<NotificationEventPreference> {
    const enabled = input.enabledChannels as unknown as Prisma.InputJsonValue;
    return this.prismaService.notificationEventPreference.upsert({
      where: { userId_eventType: { userId, eventType } },
      create: { userId, eventType, enabledChannels: enabled },
      update: { enabledChannels: enabled },
    });
  }

  async removeEventPreference(userId: string, eventType: string): Promise<void> {
    await this.prismaService.notificationEventPreference
      .delete({
        where: { userId_eventType: { userId, eventType } },
      })
      .catch(() => undefined);
  }
}
