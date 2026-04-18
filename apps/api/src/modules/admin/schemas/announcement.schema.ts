import { z } from 'zod';

export const upsertAnnouncementSchema = z.object({
  title: z.string().trim().min(2).max(200),
  body: z.string().trim().min(2).max(4_000),
  severity: z.enum(['INFO', 'WARNING', 'CRITICAL']),
  isActive: z.boolean(),
  startsAt: z.coerce.date().optional().nullable(),
  endsAt: z.coerce.date().optional().nullable(),
  audience: z.string().trim().min(1).max(40).optional(),
});

export type UpsertAnnouncementDto = z.infer<typeof upsertAnnouncementSchema>;
