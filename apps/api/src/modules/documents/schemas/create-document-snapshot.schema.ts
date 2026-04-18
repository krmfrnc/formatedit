import { z } from 'zod';

export const createDocumentSnapshotSchema = z.object({
  label: z.string().min(1).optional(),
});
