import { z } from 'zod';

export const updateUserRoleSchema = z.object({
  role: z.enum(['USER', 'ADMIN', 'EXPERT', 'SUPER_ADMIN']),
});

export const setEmailVerifiedSchema = z.object({
  verified: z.boolean(),
});

export const assignExpertSchema = z.object({
  expertUserId: z.string().min(1).nullable(),
});
