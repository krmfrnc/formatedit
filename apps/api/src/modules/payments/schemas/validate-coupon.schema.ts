import { z } from 'zod';

export const validateCouponSchema = z.object({
  code: z.string().trim().min(1).max(64).transform((value) => value.toUpperCase()),
  amountCents: z.number().int().positive(),
  currency: z
    .string()
    .trim()
    .min(3)
    .max(3)
    .transform((value) => value.toUpperCase()),
});

export type ValidateCouponInput = z.infer<typeof validateCouponSchema>;
