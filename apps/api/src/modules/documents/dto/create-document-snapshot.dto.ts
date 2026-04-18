import { IsOptional, IsString } from 'class-validator';

export class CreateDocumentSnapshotDto {
  @IsOptional()
  @IsString()
  label?: string;
}
