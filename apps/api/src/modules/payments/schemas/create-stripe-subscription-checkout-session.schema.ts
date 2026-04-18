import { z } from 'zod';

export const createStripeSubscriptionCheckoutSessionSchema = z.object({
  planCode: z.string().trim().min(1),
  interval: z.enum(['MONTH', 'YEAR']),
  priceCents: z.number().int().min(1).max(1_000_000_000),
  successUrl: z.url(),
  cancelUrl: z.url(),
  currency: z
    .string()
    .trim()
    .min(3)
    .max(3)
    .transform((value) => value.toLowerCase())
    .optional(),
});
