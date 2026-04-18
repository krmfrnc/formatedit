import { z } from 'zod';

export const upsertAnalysisAddOnSchema = z.object({
  slug: z.string().trim().min(2).max(80),
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(500).optional(),
  priceCents: z.number().int().min(0).max(1_000_000_000),
  isActive: z.boolean().optional(),
});
