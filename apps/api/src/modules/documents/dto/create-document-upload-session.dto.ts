import { IsInt, IsString, Min } from 'class-validator';

export class CreateDocumentUploadSessionDto {
  @IsString()
  fileName!: string;

  @IsString()
  mimeType!: string;

  @IsInt()
  @Min(1)
  sizeBytes!: number;
}
