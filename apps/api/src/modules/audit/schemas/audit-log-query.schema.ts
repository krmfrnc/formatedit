import { z } from 'zod';

export const auditLogQuerySchema = z.object({
  eventType: z.string().trim().min(1).optional(),
  category: z.string().trim().min(1).optional(),
  actorUserId: z.string().trim().min(1).optional(),
  targetUserId: z.string().trim().min(1).optional(),
  requestId: z.string().trim().min(1).optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});
