import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { AuditRetentionService } from '../src/modules/audit/audit-retention.service';
import { AuditService } from '../src/modules/audit/audit.service';
import { AuditEventEmitterService } from '../src/modules/audit/audit-event-emitter.service';

describe('AuditRetentionService', () => {
  let service: AuditRetentionService;
  let auditEvents: Array<{ eventType: string; metadata?: Record<string, unknown> }>;

  const mockAuditService = {
    purgeExpiredLogs: jest.fn(),
  };

  const mockAuditEventEmitter = {
    emit: jest.fn((event: { eventType: string; metadata?: Record<string, unknown> }) => {
      auditEvents.push(event);
    }),
  };

  const mockConfigService = {
    get: jest.fn((_key: string, fallback: number) => fallback),
  };

  beforeEach(async () => {
    auditEvents = [];
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuditRetentionService,
        { provide: AuditService, useValue: mockAuditService },
        { provide: AuditEventEmitterService, useValue: mockAuditEventEmitter },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<AuditRetentionService>(AuditRetentionService);
  });

  afterEach(() => {
    // Clean up any intervals set by onModuleInit tests
    service.onModuleDestroy();
  });

  it('emits retention-purged event when deletions occur', async () => {
    mockAuditService.purgeExpiredLogs.mockResolvedValue({ deletedCount: 42 });

    const result = await service.runRetentionJob();
    expect(result.deletedCount).toBe(42);
    expect(auditEvents).toHaveLength(1);
    expect(auditEvents[0].eventType).toBe('audit.retention.purged');
  });

  it('does not emit event when nothing is purged', async () => {
    mockAuditService.purgeExpiredLogs.mockResolvedValue({ deletedCount: 0 });

    const result = await service.runRetentionJob();
    expect(result.deletedCount).toBe(0);
    expect(auditEvents).toHaveLength(0);
  });

  it('sets up an interval on module init', () => {
    jest.useFakeTimers();
    service.onModuleInit();
    expect(mockAuditService.purgeExpiredLogs).not.toHaveBeenCalled();
    jest.useRealTimers();
  });
});
