import { IsString } from 'class-validator';

export class CompleteDocumentUploadSessionDto {
  @IsString()
  sessionId!: string;
}
