import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import type { AuditEventPayload } from './audit.types';
import { AuditService } from './audit.service';

@Injectable()
export class AuditListener {
  constructor(private readonly auditService: AuditService) {}

  @OnEvent('audit.log', { async: true })
  handleAuditLog(payload: AuditEventPayload): Promise<void> {
    return this.auditService.logEvent(payload);
  }
}
