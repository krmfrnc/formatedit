import { z } from 'zod';

export const createDocumentUploadSessionSchema = z.object({
  fileName: z.string().trim().min(1),
  mimeType: z.string().trim().min(1),
  sizeBytes: z.number().int().min(1),
});
