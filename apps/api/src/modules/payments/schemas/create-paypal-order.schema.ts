import { z } from 'zod';

export const createPayPalOrderSchema = z.object({
  analysisTicketId: z.string().trim().min(1),
  returnUrl: z.url(),
  cancelUrl: z.url(),
  currency: z
    .string()
    .trim()
    .min(3)
    .max(3)
    .transform((value) => value.toUpperCase())
    .optional(),
  couponCode: z
    .string()
    .trim()
    .min(1)
    .max(64)
    .transform((value) => value.toUpperCase())
    .optional(),
});
