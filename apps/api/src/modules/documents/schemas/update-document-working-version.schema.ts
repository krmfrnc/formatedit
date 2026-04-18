import { z } from 'zod';

const documentBlockSchema = z.object({
  blockType: z.string().min(1),
  semanticSectionType: z.string().min(1),
  title: z.string().nullable().optional(),
  text: z.string().min(1),
  level: z.number().int().min(1).max(5).nullable().optional(),
  numberingPattern: z.string().nullable().optional(),
  numberingOverride: z
    .object({
      mode: z.enum(['INHERIT', 'RENUMBER', 'REMOVE', 'CUSTOM']),
      customValue: z.string().nullable().optional(),
    })
    .nullable()
    .optional(),
  manualSequenceNumber: z.number().int().min(1).nullable().optional(),
});

export const updateDocumentWorkingVersionSchema = z.object({
  blocks: z.array(documentBlockSchema).min(1),
  label: z.string().min(1).optional(),
  settings: z
    .object({
      pageNumbering: z
        .object({
          frontMatterStyle: z.enum(['roman', 'arabic']).optional(),
          bodyStyle: z.enum(['arabic', 'roman']).optional(),
          bodyStartPage: z.number().int().min(1).optional(),
          bodyStartNumber: z.number().int().min(1).optional(),
          unnumberedPages: z.array(z.number().int().min(1)).optional(),
        })
        .optional(),
      sequence: z
        .object({
          tableStart: z.number().int().min(1).optional(),
          figureStart: z.number().int().min(1).optional(),
          equationStart: z.number().int().min(1).optional(),
        })
        .optional(),
    })
    .optional(),
  cascadeNotifications: z.array(z.any()).optional(),
});
