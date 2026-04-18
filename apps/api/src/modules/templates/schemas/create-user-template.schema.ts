import { z } from 'zod';
import { templateParametersSchema } from './template-parameters.schema';

export const createUserTemplateSchema = z.object({
  name: z.string().trim().min(3).max(120),
  description: z.string().trim().max(500).optional(),
  baseTemplateId: z.string().trim().min(3).optional(),
  templateParameters: templateParametersSchema,
});
