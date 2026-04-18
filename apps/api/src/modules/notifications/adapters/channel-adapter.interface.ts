import type { Notification, User } from '@prisma/client';

export interface ChannelDispatchResult {
  providerMessageId: string | null;
}

export interface ChannelAdapter {
  readonly name: string;
  send(notification: Notification, user: User): Promise<ChannelDispatchResult>;
}
