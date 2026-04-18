import { z } from 'zod';

const fixedPageListSchema = z.array(z.string().trim().min(1).max(80)).max(20);

export const upsertWorkTypeSettingSchema = z.object({
  slug: z.string().trim().min(2).max(80).regex(/^[a-z0-9-]+$/),
  label: z.string().trim().min(2).max(120),
  isActive: z.boolean().optional(),
  requiredFixedPages: fixedPageListSchema,
  optionalFixedPages: fixedPageListSchema,
});
