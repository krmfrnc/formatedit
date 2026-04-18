import { z } from 'zod';

export const createAnalysisTicketSchema = z.object({
  categorySlug: z.string().trim().min(2).max(80),
  title: z.string().trim().min(3).max(200),
  brief: z.string().trim().min(10).max(10_000),
  deliveryMode: z.enum(['STANDARD', 'EXPRESS']).optional(),
});
