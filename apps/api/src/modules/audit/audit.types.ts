import type { AuditActorType, UserRole } from '@prisma/client';

export interface AuditEventPayload {
  eventType: string;
  category: string;
  actorType?: AuditActorType;
  actorUserId?: string;
  actorRole?: UserRole;
  entityType?: string;
  entityId?: string;
  targetUserId?: string;
  route?: string;
  method?: string;
  statusCode?: number;
  ipAddress?: string;
  userAgent?: string;
  requestId?: string;
  metadata?: Record<string, unknown>;
}

export interface AuditLogFilters {
  eventType?: string;
  category?: string;
  actorUserId?: string;
  targetUserId?: string;
  requestId?: string;
  from?: Date;
  to?: Date;
  limit: number;
}
