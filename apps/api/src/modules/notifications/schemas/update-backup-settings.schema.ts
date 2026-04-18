import { z } from 'zod';

export const updateBackupSettingsSchema = z.object({
  cadence: z.enum(['DAILY', 'WEEKLY', 'MONTHLY']),
  mode: z.enum(['FULL', 'INCREMENTAL']),
  retentionDays: z.number().int().min(1),
});
