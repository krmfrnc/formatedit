import { Test, TestingModule } from '@nestjs/testing';
import { HealthService } from '../src/modules/health/health.service';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../src/prisma.service';
import { RedisService } from '../src/redis.service';
import { QueueService } from '../src/modules/queue/queue.service';
import { StorageService } from '../src/modules/storage/storage.service';

describe('HealthService', () => {
  let service: HealthService;

  const mockConfigService = {
    getOrThrow: jest.fn((key: string) => {
      const values: Record<string, string> = { nodeEnv: 'test' };
      return values[key] ?? '';
    }),
    get: jest.fn(() => ''),
  };

  const mockPrismaService = {};
  const mockRedisService = {
    getClient: jest.fn(() => ({ status: 'ready' })),
  };
  const mockQueueService = {
    getRegisteredQueues: jest.fn(() => [
      { name: 'document-pipeline' },
      { name: 'formatting' },
    ]),
  };
  const mockStorageService = {
    getProvider: jest.fn(() => 'minio'),
    getBucket: jest.fn(() => 'formatedit'),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HealthService,
        { provide: ConfigService, useValue: mockConfigService },
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: RedisService, useValue: mockRedisService },
        { provide: QueueService, useValue: mockQueueService },
        { provide: StorageService, useValue: mockStorageService },
      ],
    }).compile();

    service = module.get<HealthService>(HealthService);
  });

  it('returns a well-structured health snapshot', () => {
    const snapshot = service.getHealthSnapshot();
    expect(snapshot.status).toBe('ok');
    expect(snapshot.timestamp).toBeDefined();
    expect(snapshot.services.api.status).toBe('ready');
    expect(snapshot.services.api.env).toBe('test');
    expect(snapshot.services.database.status).toBe('configured');
    expect(snapshot.services.redis.status).toBe('configured');
    expect(snapshot.services.queues.status).toBe('ready');
    expect(snapshot.services.queues.names).toEqual(['document-pipeline', 'formatting']);
    expect(snapshot.services.storage.status).toBe('ready');
    expect(snapshot.services.storage.provider).toBe('minio');
    expect(snapshot.services.storage.bucket).toBe('formatedit');
  });

  it('reads redis connection status', () => {
    mockRedisService.getClient.mockReturnValue({ status: 'connecting' });
    const snapshot = service.getHealthSnapshot();
    expect(snapshot.services.redis.connectionStatus).toBe('connecting');
  });
});
