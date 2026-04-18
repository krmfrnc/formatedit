import { z } from 'zod';

const configBucketSchema = z.record(z.string(), z.unknown());

export const templateParametersSchema = z.object({
  pageLayout: configBucketSchema,
  typography: configBucketSchema,
  headingHierarchy: configBucketSchema,
  pageNumbering: configBucketSchema,
  coverPages: configBucketSchema,
  fixedPages: configBucketSchema,
  sectionOrdering: configBucketSchema,
  tableFigureFormatting: configBucketSchema,
  equationFormatting: configBucketSchema,
  citations: configBucketSchema,
  restrictions: configBucketSchema,
});
