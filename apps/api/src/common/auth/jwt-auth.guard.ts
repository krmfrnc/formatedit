import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import { PrismaService } from '../../prisma.service';
import type { AuthenticatedUser, JwtTokenPayload } from './authenticated-user.interface';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly prismaService: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request & { user?: AuthenticatedUser }>();
    const token = this.extractBearerToken(request);

    if (!token) {
      throw new UnauthorizedException('Authentication token is required');
    }

    try {
      const payload = await this.jwtService.verifyAsync<JwtTokenPayload>(token, {
        secret: this.configService.getOrThrow<string>('jwtSecret'),
      });

      if (payload.type === 'refresh') {
        throw new UnauthorizedException('Refresh tokens cannot access protected routes');
      }

      const user = await this.prismaService.user.findUnique({
        where: { id: payload.sub },
        select: {
          deletedAt: true,
          anonymizedAt: true,
        },
      });

      if (!user || user.deletedAt || user.anonymizedAt) {
        throw new UnauthorizedException('Account is no longer available');
      }

      request.user = {
        id: payload.sub,
        email: payload.email,
        role: payload.role,
        impersonatedByUserId: payload.impersonatedByUserId,
        impersonationSessionId: payload.impersonationSessionId,
      };

      return true;
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }

      throw new UnauthorizedException('Invalid or expired authentication token');
    }
  }

  private extractBearerToken(request: Request): string | null {
    const authorizationHeader = request.headers.authorization;
    if (!authorizationHeader) {
      return null;
    }

    const [scheme, token] = authorizationHeader.split(' ');
    if (scheme !== 'Bearer' || !token) {
      return null;
    }

    return token;
  }
}
