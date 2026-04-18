import { z } from 'zod';
import { upsertTemplateSchema } from './upsert-template.schema';

export const importTemplatesSchema = z.object({
  overwriteExisting: z.boolean().optional(),
  officialTemplates: z.array(upsertTemplateSchema).min(1),
});
