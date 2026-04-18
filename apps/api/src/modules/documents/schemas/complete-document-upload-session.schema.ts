import { z } from 'zod';

export const completeDocumentUploadSessionSchema = z.object({
  sessionId: z.string().trim().min(1),
});
