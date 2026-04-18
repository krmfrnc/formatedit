import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import type { AuditEventPayload } from './audit.types';

@Injectable()
export class AuditEventEmitterService {
  constructor(private readonly eventEmitter: EventEmitter2) {}

  emit(payload: AuditEventPayload): void {
    this.eventEmitter.emit('audit.log', payload);
  }
}
