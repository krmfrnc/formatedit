import type { AcademicTitle, UserRole } from '@prisma/client';

export interface AuthenticatedUser {
  id: string;
  email: string;
  role: UserRole;
  academicTitle?: AcademicTitle;
  impersonatedByUserId?: string;
  impersonationSessionId?: string;
}

export interface JwtTokenPayload {
  sub: string;
  email: string;
  role: UserRole;
  type?: 'refresh';
  jti?: string;
  iat?: number;
  exp?: number;
  impersonatedByUserId?: string;
  impersonationSessionId?: string;
}
