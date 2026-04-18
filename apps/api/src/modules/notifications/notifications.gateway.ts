import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import type { Notification } from '@prisma/client';
import type { Server, Socket } from 'socket.io';
import type { JwtTokenPayload } from '../../common/auth/authenticated-user.interface';

/**
 * Task 259: In-app real-time notifications via Socket.IO.
 *
 * Authenticates each connection through a JWT on the handshake `auth.token`
 * field (falling back to the Authorization header) and joins a per-user room
 * so the in-app adapter can fan out to all of a user's open tabs.
 */
@WebSocketGateway({
  namespace: '/notifications',
  cors: { origin: true, credentials: true },
})
@Injectable()
export class NotificationsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(NotificationsGateway.name);

  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async handleConnection(socket: Socket): Promise<void> {
    const token = this.extractToken(socket);
    if (!token) {
      socket.disconnect(true);
      return;
    }
    try {
      const payload = await this.jwtService.verifyAsync<JwtTokenPayload>(token, {
        secret: this.configService.getOrThrow<string>('jwtSecret'),
      });
      if (payload.type === 'refresh') {
        socket.disconnect(true);
        return;
      }
      await socket.join(`user:${payload.sub}`);
      (socket.data as { userId?: string }).userId = payload.sub;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'unknown error';
      this.logger.warn(`Rejected notifications websocket: ${message}`);
      socket.disconnect(true);
    }
  }

  handleDisconnect(socket: Socket): void {
    const userId = (socket.data as { userId?: string }).userId;
    if (userId) {
      this.logger.debug(`Notifications socket disconnected for user ${userId}`);
    }
  }

  broadcastToUser(userId: string, notification: Notification): void {
    if (!this.server) return;
    this.server.to(`user:${userId}`).emit('notification', {
      id: notification.id,
      eventType: notification.eventType,
      title: notification.title,
      body: notification.body,
      createdAt: notification.createdAt.toISOString(),
    });
  }

  private extractToken(socket: Socket): string | null {
    const authField = socket.handshake.auth as { token?: unknown } | undefined;
    if (authField && typeof authField.token === 'string') {
      return authField.token;
    }
    const header = socket.handshake.headers.authorization;
    if (typeof header === 'string' && header.toLowerCase().startsWith('bearer ')) {
      return header.slice(7).trim();
    }
    return null;
  }
}
