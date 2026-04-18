import { Injectable } from '@nestjs/common';
import type { NotificationChannel, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma.service';
import type { BackupSettings, SupportedLanguage } from '@formatedit/shared';

/**
 * Task 264: Admin-editable per-channel kill switches, stored in the
 * `system_settings` table under keys `notifications.channel.<channel>.enabled`.
 *
 * A missing row is treated as "enabled" (default on) so that adding a new
 * channel does not require a migration to seed defaults.
 */
const CHANNEL_KEYS: Record<NotificationChannel, string> = {
  EMAIL: 'notifications.channel.email.enabled',
  IN_APP: 'notifications.channel.in_app.enabled',
  WHATSAPP: 'notifications.channel.whatsapp.enabled',
  TELEGRAM: 'notifications.channel.telegram.enabled',
};

const BACKUP_SETTINGS_KEY = 'platform.backup.settings';
const SUPPORTED_LANGUAGES_KEY = 'platform.i18n.languages';
const DEFAULT_SUPPORTED_LANGUAGES: SupportedLanguage[] = [
  { code: 'tr', label: 'Turkce' },
  { code: 'en', label: 'English' },
];

@Injectable()
export class SystemSettingsService {
  constructor(private readonly prismaService: PrismaService) {}

  async getBackupSettings(): Promise<BackupSettings | null> {
    const row = await this.prismaService.systemSetting.findUnique({
      where: { key: BACKUP_SETTINGS_KEY },
    });

    if (!row) {
      return null;
    }

    const value = row.value as Record<string, unknown>;
    const cadence = value.cadence;
    const mode = value.mode;
    const retentionDays = value.retentionDays;

    if (
      (cadence === 'DAILY' || cadence === 'WEEKLY' || cadence === 'MONTHLY') &&
      (mode === 'FULL' || mode === 'INCREMENTAL') &&
      typeof retentionDays === 'number'
    ) {
      return {
        cadence,
        mode,
        retentionDays,
      };
    }

    return null;
  }

  async getSupportedLanguages(): Promise<SupportedLanguage[]> {
    const row = await this.prismaService.systemSetting.findUnique({
      where: { key: SUPPORTED_LANGUAGES_KEY },
    });

    if (!row || !Array.isArray(row.value)) {
      return DEFAULT_SUPPORTED_LANGUAGES;
    }

    const languages = row.value
      .map((entry) => {
        if (!entry || typeof entry !== 'object') {
          return null;
        }

        const candidate = entry as Record<string, unknown>;
        if (typeof candidate.code !== 'string' || typeof candidate.label !== 'string') {
          return null;
        }

        return {
          code: candidate.code,
          label: candidate.label,
        } satisfies SupportedLanguage;
      })
      .filter((entry): entry is SupportedLanguage => entry !== null);

    return languages.length > 0 ? languages : DEFAULT_SUPPORTED_LANGUAGES;
  }

  async getDisabledChannels(): Promise<Set<NotificationChannel>> {
    const rows = await this.prismaService.systemSetting.findMany({
      where: { key: { in: Object.values(CHANNEL_KEYS) } },
    });
    const disabled = new Set<NotificationChannel>();
    for (const row of rows) {
      if (row.value === false) {
        const channel = this.keyToChannel(row.key);
        if (channel) disabled.add(channel);
      }
    }
    return disabled;
  }

  async getChannelStatuses(): Promise<Record<NotificationChannel, boolean>> {
    const disabled = await this.getDisabledChannels();
    return {
      EMAIL: !disabled.has('EMAIL'),
      IN_APP: !disabled.has('IN_APP'),
      WHATSAPP: !disabled.has('WHATSAPP'),
      TELEGRAM: !disabled.has('TELEGRAM'),
    };
  }

  async setChannelEnabled(
    channel: NotificationChannel,
    enabled: boolean,
    updatedBy: string | null,
  ): Promise<void> {
    const key = CHANNEL_KEYS[channel];
    const value = enabled as unknown as Prisma.InputJsonValue;
    await this.prismaService.systemSetting.upsert({
      where: { key },
      create: { key, value, updatedBy: updatedBy ?? undefined },
      update: { value, updatedBy: updatedBy ?? undefined },
    });
  }

  async updateBackupSettings(
    input: BackupSettings,
    updatedBy: string | null,
  ): Promise<BackupSettings> {
    const value = {
      cadence: input.cadence,
      mode: input.mode,
      retentionDays: input.retentionDays,
    } satisfies Prisma.InputJsonObject;

    await this.prismaService.systemSetting.upsert({
      where: { key: BACKUP_SETTINGS_KEY },
      create: { key: BACKUP_SETTINGS_KEY, value, updatedBy: updatedBy ?? undefined },
      update: { value, updatedBy: updatedBy ?? undefined },
    });

    return input;
  }

  async updateSupportedLanguages(
    input: SupportedLanguage[],
    updatedBy: string | null,
  ): Promise<SupportedLanguage[]> {
    const normalized = Array.from(
      new Map(
        input.map((entry) => [
          entry.code.trim().toLowerCase(),
          {
            code: entry.code.trim().toLowerCase(),
            label: entry.label.trim(),
          } satisfies SupportedLanguage,
        ]),
      ).values(),
    );

    const value = normalized.map((entry) => ({
      code: entry.code,
      label: entry.label,
    })) satisfies Prisma.InputJsonArray;

    await this.prismaService.systemSetting.upsert({
      where: { key: SUPPORTED_LANGUAGES_KEY },
      create: { key: SUPPORTED_LANGUAGES_KEY, value, updatedBy: updatedBy ?? undefined },
      update: { value, updatedBy: updatedBy ?? undefined },
    });

    return normalized;
  }

  private keyToChannel(key: string): NotificationChannel | null {
    for (const [channel, channelKey] of Object.entries(CHANNEL_KEYS)) {
      if (channelKey === key) return channel as NotificationChannel;
    }
    return null;
  }
}
