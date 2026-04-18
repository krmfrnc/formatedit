import { IsOptional, IsString, MinLength } from 'class-validator';

export class SendTwoFactorCodeDto {
  @IsString()
  @MinLength(3)
  recipient!: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  label?: string;
}
