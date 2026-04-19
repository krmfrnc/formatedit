wimport { z } from 'zod';
import { academicTitles } from '../dto/register.dto';

export const registerSchema = z.object({
  email: z.string().email().transform((value) => value.trim().toLowerCase()),
  password: z.string().min(8).max(128),
  academicTitle: z.enum(academicTitles),
});

export type RegisterInput = z.infer<typeof registerSchema>;
