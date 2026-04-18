import { Injectable } from '@nestjs/common';
import type { Notification, User } from '@prisma/client';
import { NotificationsGateway } from '../notifications.gateway';
import type { ChannelAdapter, ChannelDispatchResult } from './channel-adapter.interface';

/**
 * Task 259: In-app delivery — the Notification row is the persisted source
 * of truth (already created by NotificationsService.dispatch) and this
 * adapter's only side effect is to push the live event to any open sockets.
 */
@Injectable()
export class InAppChannelAdapter implements ChannelAdapter {
  readonly name = 'IN_APP';

  constructor(private readonly gateway: NotificationsGateway) {}

  send(notification: Notification, user: User): Promise<ChannelDispatchResult> {
    this.gateway.broadcastToUser(user.id, notification);
    return Promise.resolve({ providerMessageId: null });
  }
}
