import { z } from 'zod';

export const updateDocumentSecuritySettingsSchema = z.object({
  maxUploadSizeBytes: z.number().int().min(1),
  clamAvEnabled: z.boolean(),
  virusTotalEnabled: z.boolean(),
});
