import { z } from 'zod';

export const runAnalyticsReportSchema = z.object({
  type: z.enum(['WEEKLY', 'MONTHLY', 'ON_DEMAND']),
  start: z.coerce.date(),
  end: z.coerce.date(),
  emailTo: z.array(z.string().email()).max(20).optional(),
});

export type RunAnalyticsReportDto = z.infer<typeof runAnalyticsReportSchema>;
