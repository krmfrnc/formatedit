import { z } from 'zod';

export const rateTicketSchema = z.object({
  rating: z.number().int().min(1).max(5),
  comment: z.string().trim().max(2_000).optional(),
});
