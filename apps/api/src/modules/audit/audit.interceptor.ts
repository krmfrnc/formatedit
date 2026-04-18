import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { Observable, tap } from 'rxjs';
import type { AuthenticatedUser } from '../../common/auth/authenticated-user.interface';
import { AuditEventEmitterService } from './audit-event-emitter.service';
import { auditableEvents } from './audit.constants';

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(private readonly auditEventEmitter: AuditEventEmitterService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context
      .switchToHttp()
      .getRequest<Request & { user?: AuthenticatedUser }>();
    const response = context.switchToHttp().getResponse<Response>();
    const method = request.method.toUpperCase();

    if (!['POST', 'PATCH', 'PUT', 'DELETE'].includes(method)) {
      return next.handle();
    }

    const routePath = this.resolveRoutePath(request);

    return next.handle().pipe(
      tap(() => {
        this.auditEventEmitter.emit({
          eventType: auditableEvents.httpMutation,
          category: 'http',
          actorType: request.user ? 'USER' : 'SYSTEM',
          actorUserId: request.user?.id,
          actorRole: request.user?.role,
          entityType: 'route',
          entityId: routePath,
          route: request.originalUrl,
          method,
          statusCode: response.statusCode,
          ipAddress: request.ip,
          userAgent: request.get('user-agent') ?? undefined,
          requestId: request.get('x-request-id') ?? undefined,
          metadata: {
            routePath,
          },
        });
      }),
    );
  }

  private resolveRoutePath(request: Request): string {
    const route = request.route as { path?: string } | undefined;
    return route?.path ?? request.path;
  }
}
