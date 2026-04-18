import { z } from 'zod';
import { templateParametersSchema } from './template-parameters.schema';

export const upsertTemplateSchema = z.object({
  slug: z.string().trim().min(3).max(80).regex(/^[a-z0-9-]+$/),
  name: z.string().trim().min(3).max(120),
  description: z.string().trim().max(500).optional(),
  category: z.string().trim().min(2).max(80),
  workType: z.string().trim().min(2).max(80),
  isActive: z.boolean().optional(),
  templateParameters: templateParametersSchema,
});
