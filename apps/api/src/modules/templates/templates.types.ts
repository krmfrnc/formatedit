import type { TemplateParameterSet } from '@formatedit/shared';

export interface TemplateUpsertInput {
  slug: string;
  name: string;
  description?: string;
  category: string;
  workType: string;
  isActive?: boolean;
  templateParameters: TemplateParameterSet;
}

export interface UserTemplateCreateInput {
  name: string;
  description?: string;
  baseTemplateId?: string;
  templateParameters: TemplateParameterSet;
}

export interface UserTemplateUpdateInput {
  name: string;
  description?: string;
  templateParameters: TemplateParameterSet;
}

export interface UserTemplateCloneInput {
  name?: string;
  description?: string;
}

export interface WorkTypeSettingUpsertInput {
  slug: string;
  label: string;
  isActive?: boolean;
  requiredFixedPages: string[];
  optionalFixedPages: string[];
}
