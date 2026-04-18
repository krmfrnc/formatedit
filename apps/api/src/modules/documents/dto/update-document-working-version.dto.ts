import { IsArray, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class DocumentBlockDto {
  @IsString()
  blockType!: string;

  @IsString()
  semanticSectionType!: string;

  @IsOptional()
  @IsString()
  title?: string | null;

  @IsString()
  text!: string;

  @IsOptional()
  level?: number | null;

  @IsOptional()
  @IsString()
  numberingPattern?: string | null;

  @IsOptional()
  numberingOverride?:
    | {
        mode: 'INHERIT' | 'RENUMBER' | 'REMOVE' | 'CUSTOM';
        customValue?: string | null;
      }
    | null;

  @IsOptional()
  manualSequenceNumber?: number | null;
}

export class UpdateDocumentWorkingVersionDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DocumentBlockDto)
  blocks!: DocumentBlockDto[];

  @IsOptional()
  @IsString()
  label?: string;

  @IsOptional()
  settings?: {
    pageNumbering?: {
      frontMatterStyle?: 'roman' | 'arabic';
      bodyStyle?: 'arabic' | 'roman';
      bodyStartPage?: number;
      bodyStartNumber?: number;
      unnumberedPages?: number[];
    };
    sequence?: {
      tableStart?: number;
      figureStart?: number;
      equationStart?: number;
    };
  };

  @IsOptional()
  cascadeNotifications?: Array<{
    id: string;
    type: 'heading-numbering' | 'section-order' | 'page-numbering' | 'sequence' | 'preview';
    severity: 'info' | 'warning';
    message: string;
  }>;
}
