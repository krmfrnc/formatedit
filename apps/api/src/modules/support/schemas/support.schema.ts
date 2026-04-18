import { z } from 'zod';

export const createSupportTicketSchema = z.object({
  subject: z.string().trim().min(2).max(200),
  body: z.string().trim().min(2).max(8_000),
  channel: z.enum(['IN_APP', 'EMAIL', 'WHATSAPP', 'TELEGRAM']).optional(),
  priority: z.enum(['LOW', 'NORMAL', 'HIGH', 'URGENT']).optional(),
});

export const replySupportTicketSchema = z.object({
  body: z.string().trim().min(1).max(8_000),
});

export type CreateSupportTicketDto = z.infer<typeof createSupportTicketSchema>;
export type ReplySupportTicketDto = z.infer<typeof replySupportTicketSchema>;
