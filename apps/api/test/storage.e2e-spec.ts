import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { StorageService } from '../src/modules/storage/storage.service';

/**
 * StorageService unit tests.
 *
 * Because the S3Client calls real AWS SDK internals, we mock `client.send`
 * at the SDK boundary. This covers the service layer logic: key construction,
 * error handling, content negotiation.
 */
describe('StorageService', () => {
  let service: StorageService;
  let mockSend: jest.Mock;

  interface StorageServiceTestShim {
    client: {
      send: jest.Mock;
    };
  }

  const configValues: Record<string, string> = {
    storageProvider: 'minio',
    s3Bucket: 'formatedit',
    s3Region: 'us-east-1',
    s3Endpoint: 'http://localhost:9000',
    s3AccessKeyId: 'minio-key',
    s3SecretAccessKey: 'minio-secret',
  };

  const mockConfigService = {
    get: jest.fn((key: string, fallback?: string) =>
      configValues[key] ?? fallback ?? '',
    ),
    getOrThrow: jest.fn((key: string) => {
      const value = configValues[key];
      if (value === undefined) {
        throw new Error(`Missing config: ${key}`);
      }
      return value;
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StorageService,
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<StorageService>(StorageService);

    // Patch the internal S3Client.send so we don't need a real S3 backend.
    mockSend = jest.fn().mockResolvedValue({});
    (service as unknown as StorageServiceTestShim).client.send = mockSend;
  });

  describe('getProvider', () => {
    it('returns configured provider', () => {
      expect(service.getProvider()).toBe('minio');
    });
  });

  describe('getBucket', () => {
    it('returns configured bucket', () => {
      expect(service.getBucket()).toBe('formatedit');
    });
  });

  describe('describeObject', () => {
    it('returns structured object descriptor', () => {
      const result = service.describeObject('some/key.docx');
      expect(result).toEqual({
        bucket: 'formatedit',
        key: 'some/key.docx',
        provider: 'minio',
      });
    });
  });

  describe('uploadObject', () => {
    it('calls S3 PutObject and returns descriptor', async () => {
      const result = await service.uploadObject({
        key: 'docs/file.docx',
        body: Buffer.from('test'),
        contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      });

      expect(mockSend).toHaveBeenCalledTimes(1);
      expect(result.key).toBe('docs/file.docx');
      expect(result.bucket).toBe('formatedit');
    });
  });

  describe('deleteObject', () => {
    it('calls S3 DeleteObject', async () => {
      await service.deleteObject('docs/file.docx');
      expect(mockSend).toHaveBeenCalledTimes(1);
    });
  });

  describe('downloadObject', () => {
    it('returns buffer from body stream', async () => {
      mockSend.mockResolvedValue({
        Body: {
          transformToByteArray: () => Promise.resolve(new Uint8Array([0x50, 0x4b])),
        },
        ContentType: 'application/octet-stream',
      });

      const result = await service.downloadObject('docs/file.docx');
      expect(result.body).toBeInstanceOf(Buffer);
      expect(result.body.length).toBe(2);
      expect(result.contentType).toBe('application/octet-stream');
    });

    it('throws when body is missing', async () => {
      mockSend.mockResolvedValue({ Body: null });
      await expect(service.downloadObject('docs/file.docx')).rejects.toThrow(
        'could not be downloaded',
      );
    });
  });
});
