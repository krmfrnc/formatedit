import { z } from 'zod';

export const recordVisitSchema = z.object({
  code: z.string().trim().min(4).max(20),
  landingUrl: z.string().url().optional(),
});

export const attachReferredUserSchema = z.object({
  referralId: z.string().min(1),
  newUserId: z.string().min(1),
});

export const setRewardStatusSchema = z.object({
  status: z.enum(['PENDING', 'APPROVED', 'PAID', 'REJECTED']),
});

export const setCommissionSchema = z.object({
  commissionPercent: z.number().int().min(0).max(100),
});
