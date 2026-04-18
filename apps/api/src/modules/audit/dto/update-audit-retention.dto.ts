import { IsBoolean, IsInt, Min } from 'class-validator';

export class UpdateAuditRetentionDto {
  @IsInt()
  @Min(1)
  retentionDays!: number;

  @IsBoolean()
  isEnabled!: boolean;
}
