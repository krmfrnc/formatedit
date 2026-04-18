import { IsBoolean, IsInt, Min } from 'class-validator';

export class UpdateDocumentSecuritySettingsDto {
  @IsInt()
  @Min(1)
  maxUploadSizeBytes!: number;

  @IsBoolean()
  clamAvEnabled!: boolean;

  @IsBoolean()
  virusTotalEnabled!: boolean;
}
