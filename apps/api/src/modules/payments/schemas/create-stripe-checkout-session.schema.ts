import { z } from 'zod';

export const createStripeCheckoutSessionSchema = z.object({
  analysisTicketId: z.string().trim().min(1),
  successUrl: z.string().url(),
  cancelUrl: z.string().url(),
  currency: z
    .string()
    .trim()
    .min(3)
    .max(3)
    .transform((value) => value.toLowerCase())
    .optional(),
  couponCode: z
    .string()
    .trim()
    .min(1)
    .max(64)
    .transform((value) => value.toUpperCase())
    .optional(),
});
