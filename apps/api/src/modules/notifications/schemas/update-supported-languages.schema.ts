import { z } from 'zod';

export const updateSupportedLanguagesSchema = z.object({
  items: z
    .array(
      z.object({
        code: z.string().trim().min(2).max(10),
        label: z.string().trim().min(1).max(80),
      }),
    )
    .min(1),
});
