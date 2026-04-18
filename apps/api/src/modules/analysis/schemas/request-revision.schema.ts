import { z } from 'zod';

export const requestRevisionSchema = z.object({
  reason: z.string().trim().min(5).max(5_000),
});
