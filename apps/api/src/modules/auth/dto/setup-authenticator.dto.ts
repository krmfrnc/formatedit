import { IsOptional, IsString, MinLength } from 'class-validator';

export class SetupAuthenticatorDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  label?: string;
}
