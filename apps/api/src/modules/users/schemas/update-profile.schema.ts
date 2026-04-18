import { z } from 'zod';
import { AcademicTitle, ThemePreference } from '@prisma/client';

export const updateProfileSchema = z.object({
  fullName: z.string().trim().min(2).max(120).optional(),
  academicTitle: z.nativeEnum(AcademicTitle).optional(),
  preferredLanguage: z.string().trim().min(2).max(10).optional(),
  themePreference: z.nativeEnum(ThemePreference).optional(),
});
