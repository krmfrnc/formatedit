import { IsEnum, IsOptional, IsString, MinLength } from 'class-validator';
import { TwoFactorMethodType } from '@prisma/client';

export class VerifyTwoFactorDto {
  @IsEnum(TwoFactorMethodType)
  method!: TwoFactorMethodType;

  @IsString()
  @MinLength(6)
  code!: string;

  @IsOptional()
  @IsString()
  @MinLength(3)
  recipient?: string;

  @IsOptional()
  @IsString()
  @MinLength(10)
  methodId?: string;
}
