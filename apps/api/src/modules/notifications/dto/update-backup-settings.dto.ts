import { IsEnum, IsInt, Min } from 'class-validator';

export class UpdateBackupSettingsDto {
  @IsEnum(['DAILY', 'WEEKLY', 'MONTHLY'])
  cadence!: 'DAILY' | 'WEEKLY' | 'MONTHLY';

  @IsEnum(['FULL', 'INCREMENTAL'])
  mode!: 'FULL' | 'INCREMENTAL';

  @IsInt()
  @Min(1)
  retentionDays!: number;
}
