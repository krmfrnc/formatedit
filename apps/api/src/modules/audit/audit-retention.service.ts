import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuditEventEmitterService } from './audit-event-emitter.service';
import { auditableEvents } from './audit.constants';
import { AuditService } from './audit.service';

@Injectable()
export class AuditRetentionService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AuditRetentionService.name);
  private intervalId?: NodeJS.Timeout;

  constructor(
    private readonly auditService: AuditService,
    private readonly auditEventEmitter: AuditEventEmitterService,
    private readonly configService: ConfigService,
  ) {}

  onModuleInit(): void {
    const intervalMinutes = this.configService.get<number>('auditRetentionJobIntervalMinutes', 60);
    this.intervalId = setInterval(() => {
      void this.runRetentionJob();
    }, intervalMinutes * 60 * 1000);
  }

  onModuleDestroy(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }
  }

  async runRetentionJob(): Promise<{ deletedCount: number }> {
    const result = await this.auditService.purgeExpiredLogs();

    if (result.deletedCount > 0) {
      this.auditEventEmitter.emit({
        eventType: auditableEvents.retentionPurged,
        category: 'audit',
        actorType: 'SYSTEM',
        entityType: 'audit_log',
        statusCode: 200,
        metadata: result,
      });
    }

    this.logger.debug(`Audit retention job completed with ${result.deletedCount} deletions`);
    return result;
  }
}
