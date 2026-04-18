import { z } from 'zod';

export const sendTicketMessageSchema = z.object({
  body: z.string().trim().min(1).max(10_000),
  metadata: z.record(z.string(), z.unknown()).optional(),
});
