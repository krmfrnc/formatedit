import { z } from 'zod';
import { templateParametersSchema } from './template-parameters.schema';

export const updateUserTemplateSchema = z.object({
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(500).optional(),
  templateParameters: templateParametersSchema,
});
