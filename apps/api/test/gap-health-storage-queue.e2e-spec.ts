import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { HealthService } from '../src/modules/health/health.service';
import { PrismaService } from '../src/prisma.service';
import { RedisService } from '../src/redis.service';
import { QueueService } from '../src/modules/queue/queue.service';
import { StorageService } from '../src/modules/storage/storage.service';

const mockPrisma = {} as PrismaService;

const mockRedisClient = {
  status: 'ready',
};
const mockRedis = {
  getClient: jest.fn(() => mockRedisClient),
  getBullConnection: jest.fn(() => ({
    host: 'localhost',
    port: 6379,
  })),
} as unknown as RedisService;

const mockQueue = {
  add: jest.fn().mockResolvedValue({ id: 'job_1' }),
  getJobs: jest.fn().mockResolvedValue([]),
  close: jest.fn().mockResolvedValue(undefined),
};

jest.mock('bullmq', () => ({
  Queue: jest.fn().mockImplementation(() => mockQueue),
  Worker: jest.fn().mockImplementation(() => ({
    close: jest.fn().mockResolvedValue(undefined),
  })),
  Job: jest.fn(),
}));

const mockS3Send = jest.fn().mockResolvedValue({
  Body: {
    transformToByteArray: jest.fn().mockResolvedValue(Buffer.from('test')),
  },
  ContentType: 'application/octet-stream',
});

jest.mock('@aws-sdk/client-s3', () => ({
  S3Client: jest.fn().mockImplementation(() => ({ send: mockS3Send })),
  PutObjectCommand: jest.fn(),
  GetObjectCommand: jest.fn(),
  DeleteObjectCommand: jest.fn(),
}));

jest.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: jest.fn().mockResolvedValue('https://presigned.example.com/test'),
}));

describe('HealthService', () => {
  let healthService: HealthService;
  let storageService: StorageService;
  let queueService: QueueService;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HealthService,
        StorageService,
        QueueService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: RedisService, useValue: mockRedis },
        {
          provide: ConfigService,
          useValue: {
            get: (key: string, fallback?: string | number) => {
              const map: Record<string, string | number> = {
                nodeEnv: 'test',
                storageProvider: 'minio',
                s3Bucket: 'formatedit-test',
                s3Region: 'us-east-1',
                s3Endpoint: 'http://localhost:9000',
                s3AccessKeyId: 'minioadmin',
                s3SecretAccessKey: 'minioadmin',
                queuePrefix: 'test',
                parseWorkerConcurrency: 1,
              };
              return map[key] ?? fallback ?? '';
            },
            getOrThrow: (key: string) => {
              const map: Record<string, string> = {
                nodeEnv: 'test',
                s3Bucket: 'formatedit-test',
                s3Region: 'us-east-1',
                s3AccessKeyId: 'minioadmin',
                s3SecretAccessKey: 'minioadmin',
              };
              if (!(key in map)) {
                throw new Error(`Missing config key: ${key}`);
              }
              return map[key];
            },
          },
        },
      ],
    }).compile();

    healthService = module.get<HealthService>(HealthService);
    storageService = module.get<StorageService>(StorageService);
    queueService = module.get<QueueService>(QueueService);
  });

  describe('getHealthSnapshot', () => {
    it('returns overall ok status with all service sections', () => {
      const snapshot = healthService.getHealthSnapshot();
      expect(snapshot.status).toBe('ok');
      expect(snapshot.timestamp).toBeDefined();
      expect(snapshot.services.api.status).toBe('ready');
      expect(snapshot.services.api.env).toBe('test');
      expect(snapshot.services.database.client).toBeDefined();
      expect(snapshot.services.redis.connectionStatus).toBe('ready');
      expect(snapshot.services.queues.status).toBe('ready');
      expect(snapshot.services.queues.names).toContain('document-pipeline');
      expect(snapshot.services.storage.status).toBe('ready');
      expect(snapshot.services.storage.provider).toBe('minio');
      expect(snapshot.services.storage.bucket).toBe('formatedit-test');
    });
  });

  describe('StorageService', () => {
    it('uploads, describes, and deletes an object', async () => {
      const result = await storageService.uploadObject({
        key: 'test/file.docx',
        body: Buffer.from('content'),
        contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      });

      expect(result.bucket).toBe('formatedit-test');
      expect(result.key).toBe('test/file.docx');
      expect(result.provider).toBe('minio');

      const descriptor = storageService.describeObject('test/file.docx');
      expect(descriptor.bucket).toBe('formatedit-test');

      await storageService.deleteObject('test/file.docx');
      expect(mockS3Send).toHaveBeenCalled();
    });

    it('downloads an object and returns body with content type', async () => {
      const result = await storageService.downloadObject('test/file.docx');
      expect(result.body).toBeInstanceOf(Buffer);
      expect(result.contentType).toBe('application/octet-stream');
    });

    it('creates presigned download and upload URLs', async () => {
      const download = await storageService.createPresignedDownloadUrl('test/file.docx');
      expect(download.url).toContain('https://');
      expect(download.operation).toBe('download');

      const upload = await storageService.createPresignedUploadUrl(
        'test/file.docx',
        'application/octet-stream',
      );
      expect(upload.url).toContain('https://');
      expect(upload.operation).toBe('upload');
    });
  });

  describe('QueueService', () => {
    it('returns registered queues with default job options', () => {
      const queues = queueService.getRegisteredQueues();
      expect(queues.length).toBeGreaterThanOrEqual(3);
      expect(queues.map((q) => q.name)).toContain('document-pipeline');
      expect(queues.map((q) => q.name)).toContain('virus-scan');
      expect(queues.map((q) => q.name)).toContain('formatting');
      for (const queue of queues) {
        expect(queue.defaultJobOptions?.attempts).toBe(3);
      }
    });

    it('enqueues a virus scan job', async () => {
      const job = await queueService.enqueueVirusScanJob({
        documentId: 'doc_1',
        documentVersionId: 'ver_1',
        storageKey: 'test/file.docx',
        stage: 'virus-scan',
        requestedBy: 'user_1',
      });

      expect(job).toBeDefined();
      expect(mockQueue.add).toHaveBeenCalledWith(
        'virus-scan:doc_1',
        expect.objectContaining({ documentId: 'doc_1', stage: 'virus-scan' }),
      );
    });

    it('enqueues a parse job with deduplication id', async () => {
      await queueService.enqueueParseJob({
        documentId: 'doc_1',
        documentVersionId: 'ver_1',
        storageKey: 'test/file.docx',
        stage: 'parse',
        requestedBy: 'user_1',
      });

      expect(mockQueue.add).toHaveBeenCalledWith(
        'parse:doc_1:ver_1',
        expect.objectContaining({ stage: 'parse' }),
        expect.objectContaining({
          jobId: 'parse:doc_1:ver_1',
          attempts: 5,
        }),
      );
    });

    it('returns pipeline snapshot for a document', async () => {
      const snapshot = await queueService.getDocumentPipelineSnapshot('doc_1');
      expect(snapshot).toEqual({
        parsePending: 0,
        pdfConversionPending: 0,
      });
    });
  });
});
