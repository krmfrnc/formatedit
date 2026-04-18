import { z } from 'zod';

export const startImpersonationSchema = z.object({
  reason: z.string().trim().min(5).max(300),
});
