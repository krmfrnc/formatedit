import { z } from 'zod';

export const upsertFeatureFlagSchema = z.object({
  key: z
    .string()
    .trim()
    .min(2)
    .max(80)
    .regex(/^[a-z0-9]+(?:[._-][a-z0-9]+)*$/, 'key must be slug-like lowercase'),
  description: z.string().trim().max(500).optional().nullable(),
  enabled: z.boolean(),
  audience: z.enum(['EVERYONE', 'ADMINS_ONLY', 'PERCENTAGE_ROLLOUT', 'USER_LIST']),
  rolloutPercent: z.number().int().min(0).max(100).optional(),
  allowedUserIds: z.array(z.string().min(1)).max(10_000).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export type UpsertFeatureFlagDto = z.infer<typeof upsertFeatureFlagSchema>;
