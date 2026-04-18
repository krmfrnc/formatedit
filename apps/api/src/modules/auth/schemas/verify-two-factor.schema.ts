import { z } from 'zod';
import { TwoFactorMethodType } from '@prisma/client';

export const verifyTwoFactorSchema = z.object({
  method: z.nativeEnum(TwoFactorMethodType),
  code: z.string().trim().min(6).max(12),
  recipient: z.string().trim().min(3).optional(),
  methodId: z.string().trim().min(10).optional(),
});
