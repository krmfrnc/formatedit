import { z } from 'zod';

export const submitQuoteSchema = z.object({
  priceCents: z.number().int().min(1).max(1_000_000_000),
  note: z.string().trim().max(2_000).optional(),
  deadlineAt: z.string().datetime().optional(),
});
