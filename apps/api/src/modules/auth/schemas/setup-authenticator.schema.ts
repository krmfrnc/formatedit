import { z } from 'zod';

export const setupAuthenticatorSchema = z.object({
  label: z.string().trim().min(2).max(100).optional(),
});
