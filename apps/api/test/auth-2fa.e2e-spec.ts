import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { TwoFactorService } from '../src/modules/auth/two-factor.service';
import { PasswordService } from '../src/modules/auth/password.service';
import { PrismaService } from '../src/prisma.service';
import { RedisService } from '../src/redis.service';
import { AuditEventEmitterService } from '../src/modules/audit/audit-event-emitter.service';

const TEST_CODE = '654321';

describe('TwoFactorService', () => {
  let service: TwoFactorService;
  const redisStore = new Map<string, string>();
  const twoFactorMethods: Array<{
    id: string;
    userId: string;
    type: string;
    recipient: string | null;
    secret: string | null;
    label: string | null;
    isVerified: boolean;
    createdAt: Date;
    updatedAt: Date;
  }> = [];
  let auditEvents: Array<{ eventType: string }> = [];

  const mockPrismaService = {
    twoFactorMethod: {
      create: jest.fn(({ data }: { data: Record<string, unknown> }) => {
        const record = {
          id: `2fa_${twoFactorMethods.length + 1}`,
          ...data,
          isVerified: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        twoFactorMethods.push(record as typeof twoFactorMethods[0]);
        return Promise.resolve(record);
      }),
      findFirst: jest.fn(
        ({ where }: { where?: { userId?: string; type?: string; label?: string } }) => {
          const match = twoFactorMethods.find((m) => {
            if (where?.userId && m.userId !== where.userId) return false;
            if (where?.type && m.type !== where.type) return false;
            if (where?.label && m.label !== where.label) return false;
            return true;
          });
          return Promise.resolve(match ?? null);
        },
      ),
      update: jest.fn(
        ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
          const method = twoFactorMethods.find((m) => m.id === where.id);
          if (method) {
            Object.assign(method, data);
          }
          return Promise.resolve(method);
        },
      ),
    },
  };

  const mockRedisClient = {
    status: 'ready',
    set: jest.fn((key: string, value: string) => {
      redisStore.set(key, value);
      return Promise.resolve('OK');
    }),
    get: jest.fn((key: string) => Promise.resolve(redisStore.get(key) ?? null)),
    del: jest.fn((key: string) => {
      redisStore.delete(key);
      return Promise.resolve(1);
    }),
    expire: jest.fn(() => Promise.resolve(1)),
  };

  const mockRedisService = {
    getClient: () => mockRedisClient,
  };

  const mockAuditEmitter = {
    emit: jest.fn((event: { eventType: string }) => {
      auditEvents.push(event);
    }),
  };

  const mockConfigService = {
    get: jest.fn((_key: string, fallback?: unknown) => fallback ?? ''),
    getOrThrow: jest.fn((key: string) => {
      const values: Record<string, unknown> = {
        jwtSecret: 'test-secret',
        twoFactorCodeTtlSeconds: 300,
      };
      return values[key] ?? '';
    }),
  };

  const mockPasswordService = {
    hashOneTimeCode: (value: string) => bcrypt.hash(value, 4),
    verifyOneTimeCode: (value: string, hash: string) => bcrypt.compare(value, hash),
    generateOneTimeCode: () => TEST_CODE,
    hashPassword: (value: string) => bcrypt.hash(value, 4),
    verifyPassword: (value: string, hash: string) => bcrypt.compare(value, hash),
  };

  beforeEach(async () => {
    twoFactorMethods.length = 0;
    redisStore.clear();
    auditEvents = [];
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TwoFactorService,
        { provide: PasswordService, useValue: mockPasswordService },
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: RedisService, useValue: mockRedisService },
        { provide: AuditEventEmitterService, useValue: mockAuditEmitter },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<TwoFactorService>(TwoFactorService);
  });

  describe('sendTelegramCode', () => {
    it('generates a code and stores challenge in Redis', async () => {
      const result = await service.sendTelegramCode('user_1', {
        recipient: '@myTelegram',
        label: 'primary-telegram',
      });

      expect(result).toMatchObject({
        method: 'TELEGRAM',
        success: true,
      });
      expect(redisStore.size).toBe(1);
      expect(
        auditEvents.some((e) => e.eventType === 'auth.two_factor.challenge_sent'),
      ).toBe(true);
    });
  });

  describe('sendWhatsAppCode', () => {
    it('generates a code and stores challenge in Redis', async () => {
      const result = await service.sendWhatsAppCode('user_1', {
        recipient: '+905551112233',
        label: 'primary-whatsapp',
      });

      expect(result).toMatchObject({
        method: 'WHATSAPP',
        success: true,
      });
      expect(redisStore.size).toBe(1);
    });
  });

  describe('verify', () => {
    it('rejects invalid codes', async () => {
      await service.sendWhatsAppCode('user_1', {
        recipient: '+905551112233',
        label: 'wa',
      });

      await expect(
        service.verify('user_1', {
          method: 'WHATSAPP',
          recipient: '+905551112233',
          code: '000000',
        }),
      ).rejects.toThrow('Invalid two-factor code');
    });

    it('rejects when challenge is not found', async () => {
      await expect(
        service.verify('user_1', {
          method: 'WHATSAPP',
          recipient: '+905551112233',
          code: TEST_CODE,
        }),
      ).rejects.toThrow('challenge was not found');
    });

    it('verifies correct WhatsApp code and cleans up Redis', async () => {
      await service.sendWhatsAppCode('user_1', {
        recipient: '+905551112233',
        label: 'wa',
      });

      const result = await service.verify('user_1', {
        method: 'WHATSAPP',
        recipient: '+905551112233',
        code: TEST_CODE,
      });

      expect(result).toMatchObject({
        success: true,
        method: 'WHATSAPP',
        verified: true,
      });

      // Challenge should be deleted
      expect(redisStore.size).toBe(0);
    });

    it('verifies correct Telegram code', async () => {
      await service.sendTelegramCode('user_1', {
        recipient: '@myTelegram',
        label: 'tg',
      });

      const result = await service.verify('user_1', {
        method: 'TELEGRAM',
        recipient: '@myTelegram',
        code: TEST_CODE,
      });

      expect(result).toMatchObject({
        success: true,
        method: 'TELEGRAM',
        verified: true,
      });
    });

    it('marks method as verified in database', async () => {
      await service.sendWhatsAppCode('user_1', {
        recipient: '+905551112233',
        label: 'wa-verify',
      });

      await service.verify('user_1', {
        method: 'WHATSAPP',
        recipient: '+905551112233',
        code: TEST_CODE,
      });

      const method = twoFactorMethods.find(
        (m) => m.userId === 'user_1' && m.type === 'WHATSAPP',
      );
      expect(method?.isVerified).toBe(true);
    });
  });
});
