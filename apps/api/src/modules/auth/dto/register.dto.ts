import { IsEmail, IsEnum, IsString, MinLength } from 'class-validator';
import type { AcademicTitle } from '@formatedit/shared';

export const academicTitles = [
  'UNDERGRADUATE',
  'MASTERS_STUDENT',
  'DOCTORAL_STUDENT',
  'RESEARCH_ASSISTANT',
  'LECTURER',
  'ASSISTANT_PROFESSOR',
  'ASSOCIATE_PROFESSOR',
  'PROFESSOR',
  'OTHER',
] as const satisfies readonly AcademicTitle[];

export class RegisterDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  password!: string;

  @IsEnum(academicTitles)
  academicTitle!: AcademicTitle;
}
