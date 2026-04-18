import { z } from 'zod';

export const createLegalDraftSchema = z.object({
  slug: z.enum(['TERMS', 'PRIVACY', 'KVKK', 'GDPR', 'COOKIES']),
  locale: z.string().trim().min(2).max(10).optional(),
  title: z.string().trim().min(2).max(200),
  content: z.string().trim().min(2),
});

export type CreateLegalDraftDto = z.infer<typeof createLegalDraftSchema>;
