import { IsEnum, IsOptional, IsString, MinLength } from 'class-validator';
import { AcademicTitle, ThemePreference } from '@prisma/client';

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  fullName?: string;

  @IsOptional()
  @IsEnum(AcademicTitle)
  academicTitle?: AcademicTitle;

  @IsOptional()
  @IsString()
  @MinLength(2)
  preferredLanguage?: string;

  @IsOptional()
  @IsEnum(ThemePreference)
  themePreference?: ThemePreference;
}
