import { z } from 'zod';

export const updateAuditRetentionSchema = z.object({
  retentionDays: z.number().int().min(1),
  isEnabled: z.boolean(),
});
