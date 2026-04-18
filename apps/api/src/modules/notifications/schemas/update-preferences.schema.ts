import { z } from 'zod';

export const updateGlobalPreferencesSchema = z.object({
  emailEnabled: z.boolean().optional(),
  inAppEnabled: z.boolean().optional(),
  whatsappEnabled: z.boolean().optional(),
  telegramEnabled: z.boolean().optional(),
});

export type UpdateGlobalPreferencesInput = z.infer<typeof updateGlobalPreferencesSchema>;

const channelEnum = z.enum(['EMAIL', 'IN_APP', 'WHATSAPP', 'TELEGRAM']);

export const updateEventPreferenceSchema = z.object({
  enabledChannels: z.array(channelEnum),
});

export type UpdateEventPreferenceInput = z.infer<typeof updateEventPreferenceSchema>;

export const updateChannelToggleSchema = z.object({
  channel: channelEnum,
  enabled: z.boolean(),
});

export type UpdateChannelToggleInput = z.infer<typeof updateChannelToggleSchema>;
