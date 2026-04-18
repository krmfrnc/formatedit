import { z } from 'zod';

export const promoteUserTemplateSchema = z.object({
  slug: z.string().trim().min(3).max(120),
  category: z.string().trim().min(2).max(120),
  workType: z.string().trim().min(2).max(120),
  name: z.string().trim().min(2).max(120).optional(),
  description: z.string().trim().max(500).optional(),
  isActive: z.boolean().optional(),
});
