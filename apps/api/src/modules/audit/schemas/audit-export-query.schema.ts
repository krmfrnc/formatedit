import { z } from 'zod';
import { auditLogQuerySchema } from './audit-log-query.schema';

export const auditExportQuerySchema = auditLogQuerySchema.extend({
  fileName: z.string().trim().min(1).optional(),
  format: z.enum(['csv', 'excel']),
});
