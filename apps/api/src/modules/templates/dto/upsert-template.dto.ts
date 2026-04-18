import type { TemplateParameterSet } from '@formatedit/shared';

export class UpsertTemplateDto {
  slug!: string;
  name!: string;
  description?: string;
  category!: string;
  workType!: string;
  isActive?: boolean;
  templateParameters!: TemplateParameterSet;
}
