import { z } from 'zod';

export const sendTwoFactorCodeSchema = z.object({
  recipient: z.string().trim().min(3),
  label: z.string().trim().min(2).max(100).optional(),
});

export type SendTwoFactorCodeInput = z.infer<typeof sendTwoFactorCodeSchema>;
