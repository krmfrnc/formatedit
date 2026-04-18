import { IsOptional, IsString, MinLength } from 'class-validator';

export class StopImpersonationDto {
  @IsOptional()
  @IsString()
  @MinLength(10)
  impersonationSessionId?: string;
}
