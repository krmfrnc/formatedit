import { z } from 'zod';

export const createTicketNdaSchema = z.object({
  expertUserId: z.string().trim().min(1),
  documentStorageKey: z.string().trim().min(1).max(500).optional(),
});
