import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { Server, Socket } from 'socket.io';
import type { JwtTokenPayload } from '../../common/auth/authenticated-user.interface';
import { PrismaService } from '../../prisma.service';
import { appLogger } from '../../common/logger';
import type { DocumentPreviewState } from '@formatedit/shared';

interface JoinDocumentPayload {
  documentId: string;
  token: string;
}

// Sockets that don't successfully `document:join` within this window are
// disconnected. Protects against idle / half-open connections piling up.
const JOIN_GRACE_PERIOD_MS = 30_000;

@Injectable()
@WebSocketGateway({
  namespace: '/documents',
  cors: {
    origin: true,
    credentials: false,
  },
  // Socket.io heartbeat: the server pings every `pingInterval`, and if no
  // pong arrives within `pingTimeout` the socket is forcibly closed. These
  // values detect dead peers faster than the defaults (25s / 20s) while
  // staying well above typical NAT / proxy idle timeouts.
  pingInterval: 20_000,
  pingTimeout: 10_000,
})
export class DocumentPreviewGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  /**
   * Per-socket join-grace timers. If a socket connects but never authenticates
   * via `document:join` within {@link JOIN_GRACE_PERIOD_MS}, it gets booted
   * to release server-side resources.
   */
  private readonly joinTimers = new Map<string, NodeJS.Timeout>();

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly prismaService: PrismaService,
  ) {}

  handleConnection(client: Socket): void {
    appLogger.info('Document preview socket connected', {
      socketId: client.id,
    });

    const timer = setTimeout(() => {
      // Client hasn't joined a document room — drop the connection.
      if (client.connected && client.rooms.size <= 1) {
        appLogger.warn('Dropping unauthenticated preview socket', {
          socketId: client.id,
        });
        client.disconnect(true);
      }
    }, JOIN_GRACE_PERIOD_MS);

    this.joinTimers.set(client.id, timer);
  }

  handleDisconnect(client: Socket): void {
    const timer = this.joinTimers.get(client.id);
    if (timer) {
      clearTimeout(timer);
      this.joinTimers.delete(client.id);
    }
    appLogger.info('Document preview socket disconnected', {
      socketId: client.id,
    });
  }

  @SubscribeMessage('document:join')
  async handleJoinDocument(
    @MessageBody() payload: JoinDocumentPayload,
    @ConnectedSocket() client: Socket,
  ): Promise<{ joined: true; room: string }> {
    if (!payload?.documentId || !payload?.token) {
      throw new UnauthorizedException('Document subscription requires token and documentId');
    }

    let jwtPayload: JwtTokenPayload;
    try {
      jwtPayload = await this.jwtService.verifyAsync<JwtTokenPayload>(payload.token, {
        secret: this.configService.getOrThrow<string>('jwtSecret'),
      });
    } catch {
      throw new UnauthorizedException('Invalid document channel token');
    }

    if (jwtPayload.type === 'refresh') {
      throw new UnauthorizedException('Refresh token cannot open realtime document channel');
    }

    const document = await this.prismaService.document.findFirst({
      where: {
        id: payload.documentId,
        userId: jwtPayload.sub,
        deletedAt: null,
      },
      select: { id: true },
    });

    if (!document) {
      throw new UnauthorizedException('Document channel access denied');
    }

    const room = this.toRoomName(payload.documentId);
    await client.join(room);

    // Successfully authenticated — cancel the grace-period drop.
    const timer = this.joinTimers.get(client.id);
    if (timer) {
      clearTimeout(timer);
      this.joinTimers.delete(client.id);
    }

    return { joined: true, room };
  }

  @SubscribeMessage('document:leave')
  async handleLeaveDocument(
    @MessageBody() payload: { documentId: string },
    @ConnectedSocket() client: Socket,
  ): Promise<{ left: true }> {
    if (payload?.documentId) {
      await client.leave(this.toRoomName(payload.documentId));
    }

    return { left: true };
  }

  emitPreviewUpdated(documentId: string, preview: DocumentPreviewState): void {
    this.server.to(this.toRoomName(documentId)).emit('preview:updated', {
      documentId,
      preview,
    });
  }

  private toRoomName(documentId: string): string {
    return `document:${documentId}`;
  }
}
