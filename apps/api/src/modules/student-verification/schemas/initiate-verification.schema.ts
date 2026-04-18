import { z } from 'zod';

export const initiateStudentVerificationSchema = z.object({
  successRedirectUrl: z.url().optional(),
});

export type InitiateStudentVerificationInput = z.infer<
  typeof initiateStudentVerificationSchema
>;
