import type { TemplateParameterSet } from '@formatedit/shared';

export class CreateUserTemplateDto {
  name!: string;
  description?: string;
  baseTemplateId?: string;
  templateParameters!: TemplateParameterSet;
}
