import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import * as bcrypt from 'bcrypt';
import { authenticator } from 'otplib';
import { GlobalExceptionFilter } from '../src/common/filters/global-exception.filter';
import { createGlobalValidationPipe } from '../src/common/pipes/global-validation.pipe';
import { QueueService } from '../src/modules/queue/queue.service';
import { StorageService } from '../src/modules/storage/storage.service';
import { PrismaService } from '../src/prisma.service';
import { RedisService } from '../src/redis.service';
import { PasswordService } from '../src/modules/auth/password.service';
import type {
  AuthSession,
  DocumentCitationValidationReport,
  DocumentPreviewState,
  DocumentVersionDiff,
  EditorDocumentVersionState,
  ParsedDocumentDiagnostics,
  ParsedDocumentMetrics,
  ParsedDocumentResult,
} from '@formatedit/shared';

jest.mock('mammoth', () => ({
  convertToHtml: jest.fn(() =>
    Promise.resolve({
      value:
        '<h1>ABSTRACT</h1><p><strong>1. Introduction</strong></p><p>Body text with citation (Smith, 2024).</p><p>Table 1 Sample table</p>',
      messages: [],
    }),
  ),
}));

interface MockUserRecord {
  id: string;
  email: string;
  passwordHash: string;
  fullName: string | null;
  role: 'USER' | 'ADMIN' | 'EXPERT' | 'SUPER_ADMIN';
  academicTitle: string;
  preferredLanguage: string;
  themePreference: 'SYSTEM' | 'LIGHT' | 'DARK';
  createdAt: Date;
  isEmailVerified?: boolean;
  deletedAt?: Date | null;
  anonymizedAt?: Date | null;
}

interface MockRefreshTokenRecord {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  revokedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  user?: MockUserRecord;
}

interface MockTwoFactorMethodRecord {
  id: string;
  userId: string;
  type: 'WHATSAPP' | 'TELEGRAM' | 'AUTHENTICATOR';
  label: string | null;
  secret: string | null;
  isVerified: boolean;
  createdAt: Date;
  updatedAt: Date;
}

interface MockNotificationPreferenceRecord {
  id: string;
  userId: string;
  emailEnabled: boolean;
  inAppEnabled: boolean;
  whatsappEnabled: boolean;
  telegramEnabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

interface MockImpersonationSessionRecord {
  id: string;
  adminId: string;
  targetUserId: string;
  reason: string;
  startedAt: Date;
  endedAt: Date | null;
  lastActiveAt: Date;
}

interface MockAuditLogRecord {
  id: string;
  eventType: string;
  category: string;
  actorType: 'USER' | 'SYSTEM';
  actorUserId: string | null;
  actorRole: MockUserRecord['role'] | null;
  entityType: string | null;
  entityId: string | null;
  targetUserId: string | null;
  route: string | null;
  method: string | null;
  statusCode: number | null;
  ipAddress: string | null;
  userAgent: string | null;
  requestId: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: Date;
}

interface MockAuditRetentionSettingRecord {
  id: 'default';
  retentionDays: number;
  isEnabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

interface MockDocumentRecord {
  id: string;
  userId: string;
  title: string;
  originalFileName: string;
  mimeType: string;
  sizeBytes: number;
  currentScanStatus: 'PENDING' | 'CLEAN' | 'INFECTED' | 'FAILED' | 'SKIPPED';
  lastScanDetails: Record<string, unknown>[] | null;
  processingProgress: number;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

interface MockDocumentVersionRecord {
  id: string;
  documentId: string;
  type: 'RAW' | 'WORKING' | 'FORMATTED' | 'REVISION' | 'PREVIEW' | 'FINAL' | 'ARCHIVE';
  label: string | null;
  storageKey: string | null;
  contentType: string | null;
  sizeBytes: number | null;
  metadata: Record<string, unknown> | null;
  createdAt: Date;
}

interface MockDocumentSectionRecord {
  id: string;
  documentId: string;
  documentVersionId: string | null;
  parentSectionId: string | null;
  sectionType: string;
  title: string | null;
  content: Record<string, unknown> | null;
  orderIndex: number;
  level: number | null;
  confidenceScore: number | null;
  createdAt: Date;
  updatedAt: Date;
}

interface MockDocumentUploadSessionRecord {
  id: string;
  userId: string;
  documentId: string | null;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  storageKey: string;
  status: 'CREATED' | 'UPLOADED' | 'COMPLETED' | 'CANCELLED';
  progress: number;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

interface MockDocumentSecuritySettingRecord {
  id: 'default';
  maxUploadSizeBytes: number;
  clamAvEnabled: boolean;
  virusTotalEnabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

interface MockSystemSettingRecord {
  key: string;
  value: unknown;
  updatedAt: Date;
  updatedBy: string | null;
}

interface MockTemplateRecord {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  category: string;
  workType: string;
  isActive: boolean;
  isArchived: boolean;
  version: number;
  usageCount: number;
  templateParameters: Record<string, unknown>;
  createdByUserId: string | null;
  sourceUserTemplateId: string | null;
  previousVersionId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

interface MockUserTemplateRecord {
  id: string;
  userId: string;
  baseTemplateId: string | null;
  name: string;
  description: string | null;
  isArchived: boolean;
  isPromoted: boolean;
  usageCount: number;
  templateParameters: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

interface MockWorkTypeSettingRecord {
  id: string;
  slug: string;
  label: string;
  isActive: boolean;
  requiredFixedPages: string[];
  optionalFixedPages: string[];
  createdAt: Date;
  updatedAt: Date;
}

interface MockAnalysisCategoryRecord {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  isActive: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

interface MockAnalysisAddOnRecord {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  priceCents: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

interface MockAnalysisTicketRecord {
  id: string;
  ticketNumber: string;
  customerUserId: string;
  assignedExpertUserId: string | null;
  categorySlug: string;
  categoryNameSnapshot: string;
  title: string;
  brief: string;
  status:
    | 'OPEN'
    | 'ASSIGNED'
    | 'QUOTED'
    | 'AWAITING_PAYMENT'
    | 'IN_PROGRESS'
    | 'DELIVERED'
    | 'REVISION_REQUESTED'
    | 'CLOSED'
    | 'CANCELLED';
  deliveryMode: 'STANDARD' | 'EXPRESS';
  quotePriceCents: number | null;
  quoteNote: string | null;
  quotedAt: Date | null;
  customerApprovedAt: Date | null;
  revisionCount: number;
  maxRevisions: number;
  rating: number | null;
  ratingComment: string | null;
  ratedAt: Date | null;
  deadlineAt: Date | null;
  assignedAt: Date | null;
  closedAt: Date | null;
  lastActivityAt: Date;
  metadata: Record<string, unknown> | null;
  createdAt: Date;
  updatedAt: Date;
}

interface MockTicketFileRecord {
  id: string;
  ticketId: string;
  uploadedByUserId: string;
  fileType: 'DATA' | 'DESCRIPTION' | 'SAMPLE' | 'RESULT';
  storageKey: string;
  originalFileName: string;
  mimeType: string;
  sizeBytes: number;
  metadata: Record<string, unknown> | null;
  createdAt: Date;
}

interface MockExpertProfileRecord {
  id: string;
  userId: string;
  bio: string | null;
  maxConcurrent: number;
  activeTickets: number;
  isAvailable: boolean;
  averageRating: number | null;
  totalCompleted: number;
  createdAt: Date;
  updatedAt: Date;
}

interface MockExpertiseTagRecord {
  id: string;
  expertProfileId: string;
  categorySlug: string;
  createdAt: Date;
}

interface MockTicketMessageRecord {
  id: string;
  ticketId: string;
  senderUserId: string | null;
  senderType: 'CUSTOMER' | 'EXPERT' | 'SYSTEM';
  body: string;
  metadata: Record<string, unknown> | null;
  createdAt: Date;
}

interface MockNdaAgreementRecord {
  id: string;
  ticketId: string;
  expertUserId: string;
  agreedAt: Date | null;
  documentStorageKey: string | null;
  createdAt: Date;
}

interface AuthenticatorSetupResponse {
  methodId: string;
  method: 'AUTHENTICATOR';
  label: string;
  secret: string;
  otpauthUrl: string;
}

interface TwoFactorVerifyResponse {
  success: true;
  method: 'AUTHENTICATOR' | 'WHATSAPP' | 'TELEGRAM';
  verified: true;
}

interface ImpersonationStartResponse {
  accessToken: string;
  impersonationSessionId: string;
  targetUser: {
    email: string;
  };
  bannerMessage: string;
}

interface MinimalUserResponse {
  email: string;
}

interface ErrorResponse {
  requestId: string;
}

interface AccountDeletionResponse {
  success: true;
  anonymizedAt: string;
}

interface DocumentUploadResponse {
  documentId: string;
  versionId: string;
  originalFileName: string;
}

interface DocumentDetailResponse {
  versions: Array<{ id: string; type: string }>;
}

const defaultTemplateParameters = {
  pageLayout: { paperSize: 'A4', marginTopCm: 4 },
  typography: { fontFamily: 'Times New Roman', fontSizePt: 12 },
  headingHierarchy: { levels: 5 },
  pageNumbering: { startAt: 1, position: 'bottom-center' },
  coverPages: { enabled: true },
  fixedPages: { acknowledgements: true, abstract: true },
  sectionOrdering: { items: ['cover', 'abstract', 'introduction', 'references'] },
  tableFigureFormatting: { tableLabel: 'Tablo', figureLabel: 'Sekil' },
  equationFormatting: { numbering: 'right' },
  citations: { style: 'APA7', inline: 'author-date' },
  restrictions: { maxHeadingLevel: 5 },
};

interface PresignedUrlResponse {
  url: string;
}

interface UploadSessionResponse {
  sessionId: string;
  status: string;
  progress: number;
}

interface ConfidenceResponse {
  documentId: string;
  lowConfidence: boolean;
}

interface PdfConvertResponse {
  queued: true;
  lowConfidence: true;
}

interface CreateUserArgs {
  data: {
    email: string;
    passwordHash: string;
    fullName?: string | null;
    academicTitle: string;
    preferredLanguage?: string;
    themePreference?: 'SYSTEM' | 'LIGHT' | 'DARK';
    isEmailVerified?: boolean;
    notificationPreference?: { create: Record<string, never> };
    oauthAccounts?: {
      create: {
        provider: 'GOOGLE';
        providerAccountId: string;
        providerEmail?: string;
      };
    };
  };
}

const redisStore = new Map<string, string>();
let mockUsers: MockUserRecord[] = [];
let mockRefreshTokens: MockRefreshTokenRecord[] = [];
let mockTwoFactorMethods: MockTwoFactorMethodRecord[] = [];
let mockNotificationPreferences: MockNotificationPreferenceRecord[] = [];
let mockImpersonationSessions: MockImpersonationSessionRecord[] = [];
let refreshTokenSequence = 0;
let twoFactorMethodSequence = 0;
let notificationPreferenceSequence = 0;
let impersonationSequence = 0;
let existingUserPasswordHash = '';
const testTwoFactorCode = '123456';
let mockAuditLogs: MockAuditLogRecord[] = [];
let mockAuditRetentionSetting: MockAuditRetentionSettingRecord = {
  id: 'default',
  retentionDays: 180,
  isEnabled: true,
  createdAt: new Date('2026-04-13T00:00:00.000Z'),
  updatedAt: new Date('2026-04-13T00:00:00.000Z'),
};
let auditLogSequence = 0;
let mockDocuments: MockDocumentRecord[] = [];
let mockDocumentVersions: MockDocumentVersionRecord[] = [];
let mockDocumentSecuritySetting: MockDocumentSecuritySettingRecord = {
  id: 'default',
  maxUploadSizeBytes: 10 * 1024 * 1024,
  clamAvEnabled: false,
  virusTotalEnabled: false,
  createdAt: new Date('2026-04-14T00:00:00.000Z'),
  updatedAt: new Date('2026-04-14T00:00:00.000Z'),
};
let mockSystemSettings: MockSystemSettingRecord[] = [];
let documentSequence = 0;
let documentVersionSequence = 0;
let documentSectionSequence = 0;
let documentUploadSessionSequence = 0;
let templateSequence = 0;
let userTemplateSequence = 0;
let mockDocumentUploadSessions: MockDocumentUploadSessionRecord[] = [];
let mockDocumentSections: MockDocumentSectionRecord[] = [];
let mockTemplates: MockTemplateRecord[] = [];
let mockUserTemplates: MockUserTemplateRecord[] = [];
let mockWorkTypeSettings: MockWorkTypeSettingRecord[] = [];
let mockAnalysisCategories: MockAnalysisCategoryRecord[] = [];
let mockAnalysisAddOns: MockAnalysisAddOnRecord[] = [];
let mockAnalysisTickets: MockAnalysisTicketRecord[] = [];
let mockTicketFiles: MockTicketFileRecord[] = [];
let mockExpertProfiles: MockExpertProfileRecord[] = [];
let mockExpertiseTags: MockExpertiseTagRecord[] = [];
let mockTicketMessages: MockTicketMessageRecord[] = [];
let mockNdaAgreements: MockNdaAgreementRecord[] = [];

const mockUserDelegate = {
  findUnique: jest.fn(
    ({
      where,
      include,
      select,
    }: {
      where: { email?: string; id?: string };
      include?: { notificationPreference: true };
      select?: { deletedAt?: true; anonymizedAt?: true };
    }) => {
      let user = null as MockUserRecord | null;

      if (where.email) {
        user = mockUsers.find((entry) => entry.email === where.email) ?? null;
      }

      if (where.id) {
        user = mockUsers.find((entry) => entry.id === where.id) ?? null;
      }

      if (!user) {
        return Promise.resolve(null);
      }

      if (select) {
        return Promise.resolve({
          deletedAt: user.deletedAt ?? null,
          anonymizedAt: user.anonymizedAt ?? null,
        });
      }

      if (include?.notificationPreference) {
        return Promise.resolve({
          ...user,
          notificationPreference:
            mockNotificationPreferences.find((preference) => preference.userId === user.id) ?? null,
        });
      }

      return Promise.resolve(user);
    },
  ),
  create: jest.fn(({ data }: CreateUserArgs) => {
    const createdUser: MockUserRecord = {
      id: `user_${mockUsers.length + 1}`,
      email: data.email,
      passwordHash: data.passwordHash,
      fullName: data.fullName ?? null,
      role: 'USER',
      academicTitle: data.academicTitle,
      preferredLanguage: data.preferredLanguage ?? 'tr',
      themePreference: data.themePreference ?? 'SYSTEM',
      createdAt: new Date('2026-04-13T00:00:00.000Z'),
      isEmailVerified: data.isEmailVerified ?? false,
      deletedAt: null,
      anonymizedAt: null,
    };

    mockUsers.push(createdUser);

    if (data.notificationPreference) {
      mockNotificationPreferences.push({
        id: `notification_${++notificationPreferenceSequence}`,
        userId: createdUser.id,
        emailEnabled: true,
        inAppEnabled: true,
        whatsappEnabled: false,
        telegramEnabled: false,
        createdAt: new Date('2026-04-13T00:00:00.000Z'),
        updatedAt: new Date('2026-04-13T00:00:00.000Z'),
      });
    }

    return Promise.resolve(createdUser);
  }),
  update: jest.fn(
    ({ where, data, include }: { where: { id: string }; data: Partial<MockUserRecord>; include?: { notificationPreference: true } }) => {
      const user = mockUsers.find((entry) => entry.id === where.id);
      if (!user) {
        throw new Error('User not found');
      }

      Object.assign(user, data);
      if (include?.notificationPreference) {
        return Promise.resolve({
          ...user,
          notificationPreference:
            mockNotificationPreferences.find((preference) => preference.userId === user.id) ?? null,
        });
      }

      return Promise.resolve(user);
    },
  ),
};

const mockRefreshTokenDelegate = {
  create: jest.fn(({ data }: { data: { userId: string; tokenHash: string; expiresAt: Date } }) => {
    const createdToken: MockRefreshTokenRecord = {
      id: `refresh_${++refreshTokenSequence}`,
      userId: data.userId,
      tokenHash: data.tokenHash,
      expiresAt: data.expiresAt,
      revokedAt: null,
      createdAt: new Date('2026-04-13T00:00:00.000Z'),
      updatedAt: new Date('2026-04-13T00:00:00.000Z'),
    };

    mockRefreshTokens.push(createdToken);
    return Promise.resolve(createdToken);
  }),
  findMany: jest.fn(
    ({ where, include }: { where: { revokedAt?: null; expiresAt?: { gt: Date } }; include?: { user: true } }) => {
      const now = where.expiresAt?.gt ?? new Date(0);
      const filtered = mockRefreshTokens.filter((token) => {
        const notRevoked = where.revokedAt === null ? token.revokedAt === null : true;
        const notExpired = token.expiresAt > now;
        return notRevoked && notExpired;
      });

      if (include?.user) {
        return Promise.resolve(
          filtered.map((token) => ({
            ...token,
            user: mockUsers.find((user) => user.id === token.userId) as MockUserRecord,
          })),
        );
      }

      return Promise.resolve(filtered);
    },
  ),
  update: jest.fn(({ where, data }: { where: { id: string }; data: { revokedAt: Date } }) => {
    const token = mockRefreshTokens.find((entry) => entry.id === where.id);
    if (!token) {
      throw new Error('Refresh token not found');
    }

    token.revokedAt = data.revokedAt;
    token.updatedAt = data.revokedAt;
    return Promise.resolve(token);
  }),
  updateMany: jest.fn(({ where, data }: { where: { userId: string; revokedAt: null }; data: { revokedAt: Date } }) => {
    let count = 0;
    mockRefreshTokens = mockRefreshTokens.map((token) => {
      if (token.userId !== where.userId || token.revokedAt !== where.revokedAt) {
        return token;
      }

      count += 1;
      return {
        ...token,
        revokedAt: data.revokedAt,
        updatedAt: data.revokedAt,
      };
    });

    return Promise.resolve({ count });
  }),
};

const mockOAuthAccountDelegate = {
  findUnique: jest.fn(() => Promise.resolve(null)),
  upsert: jest.fn(() => Promise.resolve(null)),
};

const mockTwoFactorMethodDelegate = {
  findFirst: jest.fn(({ where }: { where: Record<string, unknown> }) => {
    const method = mockTwoFactorMethods.find((entry) => {
      const candidate = entry as unknown as Record<string, unknown>;
      return Object.entries(where).every(([key, value]) => candidate[key] === value);
    });
    return Promise.resolve(method ?? null);
  }),
  create: jest.fn(
    ({ data }: { data: { userId: string; type: MockTwoFactorMethodRecord['type']; label: string; isVerified: boolean; secret?: string | null } }) => {
      const createdMethod: MockTwoFactorMethodRecord = {
        id: `two_factor_${++twoFactorMethodSequence}`,
        userId: data.userId,
        type: data.type,
        label: data.label,
        secret: data.secret ?? null,
        isVerified: data.isVerified,
        createdAt: new Date('2026-04-13T00:00:00.000Z'),
        updatedAt: new Date('2026-04-13T00:00:00.000Z'),
      };

      mockTwoFactorMethods.push(createdMethod);
      return Promise.resolve(createdMethod);
    },
  ),
  update: jest.fn(({ where, data }: { where: { id: string }; data: Partial<MockTwoFactorMethodRecord> }) => {
    const method = mockTwoFactorMethods.find((entry) => entry.id === where.id);
    if (!method) {
      throw new Error('Two-factor method not found');
    }

    Object.assign(method, data);
    method.updatedAt = new Date('2026-04-13T00:00:00.000Z');
    return Promise.resolve(method);
  }),
};

const mockNotificationPreferenceDelegate = {
  findUnique: jest.fn(({ where }: { where: { userId?: string; id?: string } }) => {
    if (where.userId) {
      return Promise.resolve(
        mockNotificationPreferences.find((entry) => entry.userId === where.userId) ?? null,
      );
    }

    if (where.id) {
      return Promise.resolve(mockNotificationPreferences.find((entry) => entry.id === where.id) ?? null);
    }

    return Promise.resolve(null);
  }),
  create: jest.fn(({ data }: { data: { userId: string } }) => {
    const record: MockNotificationPreferenceRecord = {
      id: `notification_${++notificationPreferenceSequence}`,
      userId: data.userId,
      emailEnabled: true,
      inAppEnabled: true,
      whatsappEnabled: false,
      telegramEnabled: false,
      createdAt: new Date('2026-04-13T00:00:00.000Z'),
      updatedAt: new Date('2026-04-13T00:00:00.000Z'),
    };

    mockNotificationPreferences.push(record);
    return Promise.resolve(record);
  }),
  update: jest.fn(({ where, data }: { where: { id: string }; data: Partial<MockNotificationPreferenceRecord> }) => {
    const record = mockNotificationPreferences.find((entry) => entry.id === where.id);
    if (!record) {
      throw new Error('Notification preference not found');
    }

    Object.assign(record, data);
    record.updatedAt = new Date('2026-04-13T00:00:00.000Z');
    return Promise.resolve(record);
  }),
};

const mockImpersonationSessionDelegate = {
  create: jest.fn(({ data }: { data: { adminId: string; targetUserId: string; reason: string } }) => {
    const record: MockImpersonationSessionRecord = {
      id: `impersonation_${++impersonationSequence}`,
      adminId: data.adminId,
      targetUserId: data.targetUserId,
      reason: data.reason,
      startedAt: new Date('2026-04-13T00:00:00.000Z'),
      endedAt: null,
      lastActiveAt: new Date('2026-04-13T00:00:00.000Z'),
    };

    mockImpersonationSessions.push(record);
    return Promise.resolve(record);
  }),
  findUnique: jest.fn(({ where }: { where: { id: string } }) =>
    Promise.resolve(mockImpersonationSessions.find((entry) => entry.id === where.id) ?? null),
  ),
  update: jest.fn(({ where, data }: { where: { id: string }; data: Partial<MockImpersonationSessionRecord> }) => {
    const record = mockImpersonationSessions.find((entry) => entry.id === where.id);
    if (!record) {
      throw new Error('Impersonation session not found');
    }

    Object.assign(record, data);
    return Promise.resolve(record);
  }),
  findMany: jest.fn(({ where }: { where: { targetUserId: string } }) =>
    Promise.resolve(
      mockImpersonationSessions.filter((entry) => entry.targetUserId === where.targetUserId),
    ),
  ),
};

const mockAuditLogDelegate = {
  create: jest.fn(({ data }: { data: Omit<MockAuditLogRecord, 'id' | 'createdAt'> }) => {
    const record: MockAuditLogRecord = {
      id: `audit_${++auditLogSequence}`,
      createdAt: new Date('2026-04-13T00:00:00.000Z'),
      eventType: data.eventType,
      category: data.category,
      actorType: data.actorType,
      actorUserId: data.actorUserId ?? null,
      actorRole: data.actorRole ?? null,
      entityType: data.entityType ?? null,
      entityId: data.entityId ?? null,
      targetUserId: data.targetUserId ?? null,
      route: data.route ?? null,
      method: data.method ?? null,
      statusCode: data.statusCode ?? null,
      ipAddress: data.ipAddress ?? null,
      userAgent: data.userAgent ?? null,
      requestId: data.requestId ?? null,
      metadata: (data.metadata as Record<string, unknown> | null | undefined) ?? null,
    };

    mockAuditLogs.push(record);
    return Promise.resolve(record);
  }),
  findMany: jest.fn(
    ({
      where,
      orderBy,
      take,
    }: {
      where?: {
        eventType?: string;
        category?: string;
        actorUserId?: string;
        targetUserId?: string;
        requestId?: string;
        createdAt?: { gte?: Date; lte?: Date };
      };
      orderBy?: { createdAt: 'desc' | 'asc' };
      take?: number;
    }) => {
      let filtered = [...mockAuditLogs];

      if (where?.eventType) {
        filtered = filtered.filter((entry) => entry.eventType === where.eventType);
      }
      if (where?.category) {
        filtered = filtered.filter((entry) => entry.category === where.category);
      }
      if (where?.actorUserId) {
        filtered = filtered.filter((entry) => entry.actorUserId === where.actorUserId);
      }
      if (where?.targetUserId) {
        filtered = filtered.filter((entry) => entry.targetUserId === where.targetUserId);
      }
      if (where?.requestId) {
        filtered = filtered.filter((entry) => entry.requestId === where.requestId);
      }
      if (where?.createdAt?.gte) {
        filtered = filtered.filter((entry) => entry.createdAt >= where.createdAt!.gte!);
      }
      if (where?.createdAt?.lte) {
        filtered = filtered.filter((entry) => entry.createdAt <= where.createdAt!.lte!);
      }

      filtered.sort((left, right) =>
        orderBy?.createdAt === 'asc'
          ? left.createdAt.getTime() - right.createdAt.getTime()
          : right.createdAt.getTime() - left.createdAt.getTime(),
      );

      return Promise.resolve(typeof take === 'number' ? filtered.slice(0, take) : filtered);
    },
  ),
  deleteMany: jest.fn(({ where }: { where: { createdAt: { lt: Date } } }) => {
    const before = mockAuditLogs.length;
    mockAuditLogs = mockAuditLogs.filter((entry) => entry.createdAt >= where.createdAt.lt);
    return Promise.resolve({ count: before - mockAuditLogs.length });
  }),
};

const mockAuditRetentionSettingDelegate = {
  upsert: jest.fn(
    ({
      update,
      create,
    }: {
      where: { id: 'default' };
      update: Partial<MockAuditRetentionSettingRecord>;
      create: Omit<MockAuditRetentionSettingRecord, 'createdAt' | 'updatedAt'>;
    }) => {
      mockAuditRetentionSetting = {
        ...mockAuditRetentionSetting,
        ...create,
        ...update,
        updatedAt: new Date('2026-04-13T00:00:00.000Z'),
      };
      return Promise.resolve(mockAuditRetentionSetting);
    },
  ),
};

const mockSystemSettingDelegate = {
  findMany: jest.fn(({ where }: { where?: { key?: { in?: string[] } } }) => {
    if (!where?.key?.in) {
      return Promise.resolve(mockSystemSettings);
    }

    return Promise.resolve(
      mockSystemSettings.filter((entry) => where.key?.in?.includes(entry.key)),
    );
  }),
  findUnique: jest.fn(({ where }: { where: { key: string } }) => {
    return Promise.resolve(mockSystemSettings.find((entry) => entry.key === where.key) ?? null);
  }),
  upsert: jest.fn(
    ({ where, create, update }: { where: { key: string }; create: MockSystemSettingRecord; update: Partial<MockSystemSettingRecord> }) => {
      const existingIndex = mockSystemSettings.findIndex((entry) => entry.key === where.key);
      const updatedAt = new Date();

      if (existingIndex === -1) {
        const createdRecord: MockSystemSettingRecord = {
          key: create.key,
          value: create.value,
          updatedAt,
          updatedBy: create.updatedBy ?? null,
        };
        mockSystemSettings.push(createdRecord);
        return Promise.resolve(createdRecord);
      }

      mockSystemSettings[existingIndex] = {
        ...mockSystemSettings[existingIndex],
        ...update,
        updatedAt,
        updatedBy: update.updatedBy ?? mockSystemSettings[existingIndex]?.updatedBy ?? null,
      };

      return Promise.resolve(mockSystemSettings[existingIndex]);
    },
  ),
};

const mockDocumentDelegate = {
  create: jest.fn(({ data }: { data: Omit<MockDocumentRecord, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt' | 'lastScanDetails'> }) => {
    const record: MockDocumentRecord = {
      id: `document_${++documentSequence}`,
      userId: data.userId,
      title: data.title,
      originalFileName: data.originalFileName,
      mimeType: data.mimeType,
      sizeBytes: data.sizeBytes,
      currentScanStatus: data.currentScanStatus,
      lastScanDetails: null,
      processingProgress: data.processingProgress,
      createdAt: new Date('2026-04-14T00:00:00.000Z'),
      updatedAt: new Date('2026-04-14T00:00:00.000Z'),
      deletedAt: null,
    };

    mockDocuments.push(record);
    return Promise.resolve(record);
  }),
  findMany: jest.fn(({ where }: { where: { userId: string; deletedAt: null } }) =>
    Promise.resolve(
      mockDocuments
        .filter((entry) => entry.userId === where.userId && entry.deletedAt === null)
        .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime()),
    ),
  ),
  findFirst: jest.fn(
    ({
      where,
      include,
    }: {
      where: { id?: string; userId: string; deletedAt?: null };
      include?: { versions?: { orderBy: { createdAt: 'desc' } } };
    }) => {
      const record =
        mockDocuments.find(
          (entry) =>
            entry.userId === where.userId &&
            (!where.id || entry.id === where.id) &&
            (typeof where.deletedAt === 'undefined' || entry.deletedAt === where.deletedAt),
        ) ?? null;

      if (!record) {
        return Promise.resolve(null);
      }

      if (include?.versions) {
        return Promise.resolve({
          ...record,
          versions: mockDocumentVersions
            .filter((version) => version.documentId === record.id)
            .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime()),
        });
      }

      return Promise.resolve(record);
    },
  ),
  update: jest.fn(({ where, data }: { where: { id: string }; data: Partial<MockDocumentRecord> }) => {
    const record = mockDocuments.find((entry) => entry.id === where.id);
    if (!record) {
      throw new Error('Document not found');
    }

    Object.assign(record, data);
    record.updatedAt = new Date('2026-04-14T00:00:00.000Z');
    return Promise.resolve(record);
  }),
};

const mockDocumentVersionDelegate = {
  create: jest.fn(({ data }: { data: Omit<MockDocumentVersionRecord, 'id' | 'createdAt'> }) => {
    const record: MockDocumentVersionRecord = {
      id: `document_version_${++documentVersionSequence}`,
      documentId: data.documentId,
      type: data.type,
      label: data.label ?? null,
      storageKey: data.storageKey ?? null,
      contentType: data.contentType ?? null,
      sizeBytes: data.sizeBytes ?? null,
      metadata: data.metadata ?? null,
      createdAt: new Date('2026-04-14T00:00:00.000Z'),
    };

    mockDocumentVersions.push(record);
    return Promise.resolve(record);
  }),
  update: jest.fn(({ where, data }: { where: { id: string }; data: Partial<MockDocumentVersionRecord> }) => {
    const record = mockDocumentVersions.find((entry) => entry.id === where.id);
    if (!record) {
      throw new Error('Document version not found');
    }

    Object.assign(record, data);
    return Promise.resolve(record);
  }),
  upsert: jest.fn(
    ({
      where,
      create,
      update,
    }: {
      where: { id: string };
      create: Omit<MockDocumentVersionRecord, 'createdAt'>;
      update: Partial<MockDocumentVersionRecord>;
    }) => {
      const existing = mockDocumentVersions.find((entry) => entry.id === where.id);

      if (existing) {
        Object.assign(existing, update);
        return Promise.resolve(existing);
      }

      const record: MockDocumentVersionRecord = {
        id: create.id,
        documentId: create.documentId,
        type: create.type,
        label: create.label ?? null,
        storageKey: create.storageKey ?? null,
        contentType: create.contentType ?? null,
        sizeBytes: create.sizeBytes ?? null,
        metadata: create.metadata ?? null,
        createdAt: new Date('2026-04-14T00:00:00.000Z'),
      };

      mockDocumentVersions.push(record);
      return Promise.resolve(record);
    },
  ),
  findFirst: jest.fn(
    ({
      where,
      orderBy,
    }: {
      where: { documentId: string; type: MockDocumentVersionRecord['type'] };
      orderBy?: { createdAt: 'desc' | 'asc' };
    }) =>
      Promise.resolve(
        [...mockDocumentVersions]
          .filter((entry) => entry.documentId === where.documentId && entry.type === where.type)
          .sort((left, right) =>
            orderBy?.createdAt === 'asc'
              ? left.createdAt.getTime() - right.createdAt.getTime()
              : right.createdAt.getTime() - left.createdAt.getTime(),
          )[0] ?? null,
      ),
  ),
  findUnique: jest.fn(({ where }: { where: { id: string } }) =>
    Promise.resolve(mockDocumentVersions.find((entry) => entry.id === where.id) ?? null),
  ),
};

const mockDocumentSecuritySettingDelegate = {
  upsert: jest.fn(
    ({
      update,
      create,
    }: {
      where: { id: 'default' };
      update: Partial<MockDocumentSecuritySettingRecord>;
      create: Omit<MockDocumentSecuritySettingRecord, 'createdAt' | 'updatedAt'>;
    }) => {
      mockDocumentSecuritySetting = {
        ...mockDocumentSecuritySetting,
        ...create,
        ...update,
        updatedAt: new Date('2026-04-14T00:00:00.000Z'),
      };
      return Promise.resolve(mockDocumentSecuritySetting);
    },
  ),
};

const mockTemplateDelegate = {
  findMany: jest.fn(
    ({
      where,
      orderBy,
    }: {
      where?: Partial<Pick<MockTemplateRecord, 'isActive' | 'isArchived' | 'workType'>>;
      orderBy?: Array<{ usageCount?: 'desc' | 'asc'; createdAt?: 'desc' | 'asc'; updatedAt?: 'desc' | 'asc' }>;
    }) => {
      let records = [...mockTemplates];

      if (typeof where?.isActive === 'boolean') {
        records = records.filter((entry) => entry.isActive === where.isActive);
      }

      if (typeof where?.isArchived === 'boolean') {
        records = records.filter((entry) => entry.isArchived === where.isArchived);
      }

      if (typeof where?.workType === 'string') {
        records = records.filter((entry) => entry.workType === where.workType);
      }

      if (orderBy?.length) {
        records.sort((left, right) => {
          for (const rule of orderBy) {
            if (rule.usageCount) {
              return rule.usageCount === 'asc'
                ? left.usageCount - right.usageCount
                : right.usageCount - left.usageCount;
            }

            if (rule.createdAt) {
              return rule.createdAt === 'asc'
                ? left.createdAt.getTime() - right.createdAt.getTime()
                : right.createdAt.getTime() - left.createdAt.getTime();
            }

            if (rule.updatedAt) {
              return rule.updatedAt === 'asc'
                ? left.updatedAt.getTime() - right.updatedAt.getTime()
                : right.updatedAt.getTime() - left.updatedAt.getTime();
            }
          }

          return 0;
        });
      }

      return Promise.resolve(records);
    },
  ),
  findUnique: jest.fn(({ where }: { where: { id?: string; slug?: string } }) =>
    Promise.resolve(
      mockTemplates.find((entry) => (where.id ? entry.id === where.id : entry.slug === where.slug)) ?? null,
    ),
  ),
  findFirst: jest.fn(
    ({
      where,
    }: {
      where?: {
        id?: string;
        slug?: string;
        isArchived?: boolean;
        NOT?: { id?: string };
      };
    }) => {
      const match = mockTemplates.find((entry) => {
        if (where?.id && entry.id !== where.id) return false;
        if (where?.slug && entry.slug !== where.slug) return false;
        if (typeof where?.isArchived === 'boolean' && entry.isArchived !== where.isArchived) {
          return false;
        }
        if (where?.NOT?.id && entry.id === where.NOT.id) return false;
        return true;
      });
      return Promise.resolve(match ?? null);
    },
  ),
  create: jest.fn(({ data }: { data: Omit<MockTemplateRecord, 'id' | 'createdAt' | 'updatedAt' | 'usageCount' | 'version' | 'isArchived' | 'previousVersionId'> & { usageCount?: number; version?: number; isArchived?: boolean; previousVersionId?: string | null } }) => {
    const record: MockTemplateRecord = {
      id: `template_${++templateSequence}`,
      slug: data.slug,
      name: data.name,
      description: data.description ?? null,
      category: data.category,
      workType: data.workType,
      isActive: data.isActive,
      isArchived: data.isArchived ?? false,
      version: data.version ?? 1,
      usageCount: data.usageCount ?? 0,
      templateParameters: data.templateParameters,
      createdByUserId: data.createdByUserId ?? null,
      sourceUserTemplateId: data.sourceUserTemplateId ?? null,
      previousVersionId: data.previousVersionId ?? null,
      createdAt: new Date('2026-04-14T00:00:00.000Z'),
      updatedAt: new Date('2026-04-14T00:00:00.000Z'),
    };

    mockTemplates.push(record);
    return Promise.resolve(record);
  }),
  update: jest.fn(({ where, data }: { where: { id: string }; data: Partial<MockTemplateRecord> }) => {
    const record = mockTemplates.find((entry) => entry.id === where.id);
    if (!record) {
      throw new Error('Template not found');
    }

    Object.assign(record, data);
    record.updatedAt = new Date('2026-04-14T00:00:00.000Z');
    return Promise.resolve(record);
  }),
  delete: jest.fn(({ where }: { where: { id: string } }) => {
    const record = mockTemplates.find((entry) => entry.id === where.id);
    if (!record) {
      throw new Error('Template not found');
    }

    mockTemplates = mockTemplates.filter((entry) => entry.id !== where.id);
    return Promise.resolve(record);
  }),
};

const mockUserTemplateDelegate = {
  findUnique: jest.fn(({ where }: { where: { id: string } }) =>
    Promise.resolve(mockUserTemplates.find((entry) => entry.id === where.id) ?? null),
  ),
  findMany: jest.fn(
    ({
      where,
      orderBy,
    }: {
      where?: Partial<Pick<MockUserTemplateRecord, 'userId' | 'isArchived'>>;
      orderBy?: Array<{ updatedAt?: 'desc' | 'asc' }>;
    }) => {
      let records = [...mockUserTemplates];

      if (where?.userId) {
        records = records.filter((entry) => entry.userId === where.userId);
      }

      if (typeof where?.isArchived === 'boolean') {
        records = records.filter((entry) => entry.isArchived === where.isArchived);
      }

      if (orderBy?.[0]?.updatedAt) {
        records.sort((left, right) =>
          orderBy[0].updatedAt === 'asc'
            ? left.updatedAt.getTime() - right.updatedAt.getTime()
            : right.updatedAt.getTime() - left.updatedAt.getTime(),
        );
      }

      return Promise.resolve(records);
    },
  ),
  create: jest.fn(({ data }: { data: Omit<MockUserTemplateRecord, 'id' | 'createdAt' | 'updatedAt' | 'usageCount' | 'isArchived' | 'isPromoted'> & { usageCount?: number; isArchived?: boolean; isPromoted?: boolean } }) => {
    const record: MockUserTemplateRecord = {
      id: `user_template_${++userTemplateSequence}`,
      userId: data.userId,
      baseTemplateId: data.baseTemplateId ?? null,
      name: data.name,
      description: data.description ?? null,
      isArchived: data.isArchived ?? false,
      isPromoted: data.isPromoted ?? false,
      usageCount: data.usageCount ?? 0,
      templateParameters: data.templateParameters,
      createdAt: new Date('2026-04-14T00:00:00.000Z'),
      updatedAt: new Date('2026-04-14T00:00:00.000Z'),
    };

    mockUserTemplates.push(record);
    return Promise.resolve(record);
  }),
  update: jest.fn(({ where, data }: { where: { id: string }; data: Partial<MockUserTemplateRecord> }) => {
    const record = mockUserTemplates.find((entry) => entry.id === where.id);
    if (!record) {
      throw new Error('User template not found');
    }

    Object.assign(record, data);
    record.updatedAt = new Date('2026-04-14T00:00:00.000Z');
    return Promise.resolve(record);
  }),
};

const mockWorkTypeSettingDelegate = {
  findMany: jest.fn(
    ({
      where,
      orderBy,
    }: {
      where?: Partial<Pick<MockWorkTypeSettingRecord, 'isActive'>>;
      orderBy?: Array<{ label?: 'desc' | 'asc' }>;
    }) => {
      let records = [...mockWorkTypeSettings];

      if (typeof where?.isActive === 'boolean') {
        records = records.filter((entry) => entry.isActive === where.isActive);
      }

      if (orderBy?.[0]?.label) {
        records.sort((left, right) =>
          orderBy[0].label === 'asc' ? left.label.localeCompare(right.label) : right.label.localeCompare(left.label),
        );
      }

      return Promise.resolve(records);
    },
  ),
  findUnique: jest.fn(({ where }: { where: { id?: string; slug?: string } }) =>
    Promise.resolve(
      mockWorkTypeSettings.find((entry) => (where.id ? entry.id === where.id : entry.slug === where.slug)) ?? null,
    ),
  ),
  create: jest.fn(({ data }: { data: Omit<MockWorkTypeSettingRecord, 'id' | 'createdAt' | 'updatedAt'> }) => {
    const record: MockWorkTypeSettingRecord = {
      id: `work_type_${mockWorkTypeSettings.length + 1}`,
      slug: data.slug,
      label: data.label,
      isActive: data.isActive,
      requiredFixedPages: data.requiredFixedPages,
      optionalFixedPages: data.optionalFixedPages,
      createdAt: new Date('2026-04-14T00:00:00.000Z'),
      updatedAt: new Date('2026-04-14T00:00:00.000Z'),
    };

    mockWorkTypeSettings.push(record);
    return Promise.resolve(record);
  }),
  update: jest.fn(({ where, data }: { where: { id: string }; data: Partial<MockWorkTypeSettingRecord> }) => {
    const record = mockWorkTypeSettings.find((entry) => entry.id === where.id);
    if (!record) {
      throw new Error('Work type setting not found');
    }

    Object.assign(record, data);
    record.updatedAt = new Date('2026-04-14T00:00:00.000Z');
    return Promise.resolve(record);
  }),
  delete: jest.fn(({ where }: { where: { id: string } }) => {
    const record = mockWorkTypeSettings.find((entry) => entry.id === where.id);
    if (!record) {
      throw new Error('Work type setting not found');
    }

    mockWorkTypeSettings = mockWorkTypeSettings.filter((entry) => entry.id !== where.id);
    return Promise.resolve(record);
  }),
};

const mockAnalysisCategoryDelegate = {
  findMany: jest.fn(
    ({
      orderBy,
    }: {
      orderBy?: Array<{ sortOrder?: 'asc' | 'desc'; name?: 'asc' | 'desc' }>;
    } = {}) => {
      const records = [...mockAnalysisCategories];

      if (orderBy?.length) {
        records.sort((left, right) => {
          for (const rule of orderBy) {
            if (rule.sortOrder) {
              const diff = left.sortOrder - right.sortOrder;
              if (diff !== 0) {
                return rule.sortOrder === 'asc' ? diff : -diff;
              }
            }

            if (rule.name) {
              const diff = left.name.localeCompare(right.name);
              if (diff !== 0) {
                return rule.name === 'asc' ? diff : -diff;
              }
            }
          }

          return 0;
        });
      }

      return Promise.resolve(records);
    },
  ),
  findUnique: jest.fn(({ where }: { where: { id?: string; slug?: string } }) =>
    Promise.resolve(
      mockAnalysisCategories.find((entry) =>
        where.id ? entry.id === where.id : entry.slug === where.slug,
      ) ?? null,
    ),
  ),
  findFirst: jest.fn(
    ({
      where,
    }: {
      where?: {
        slug?: string;
        NOT?: { id?: string };
      };
    }) =>
      Promise.resolve(
        mockAnalysisCategories.find((entry) => {
          if (where?.slug && entry.slug !== where.slug) {
            return false;
          }

          if (where?.NOT?.id && entry.id === where.NOT.id) {
            return false;
          }

          return true;
        }) ?? null,
      ),
  ),
  create: jest.fn(
    ({
      data,
    }: {
      data: Omit<MockAnalysisCategoryRecord, 'id' | 'createdAt' | 'updatedAt'>;
    }) => {
      const record: MockAnalysisCategoryRecord = {
        id: `analysis_category_${mockAnalysisCategories.length + 1}`,
        slug: data.slug,
        name: data.name,
        description: data.description ?? null,
        isActive: data.isActive,
        sortOrder: data.sortOrder,
        createdAt: new Date('2026-04-16T00:00:00.000Z'),
        updatedAt: new Date('2026-04-16T00:00:00.000Z'),
      };

      mockAnalysisCategories.push(record);
      return Promise.resolve(record);
    },
  ),
  update: jest.fn(
    ({
      where,
      data,
    }: {
      where: { id: string };
      data: Partial<MockAnalysisCategoryRecord>;
    }) => {
      const record = mockAnalysisCategories.find((entry) => entry.id === where.id);

      if (!record) {
        throw new Error('Analysis category not found');
      }

      Object.assign(record, data);
      record.updatedAt = new Date('2026-04-16T00:00:00.000Z');
      return Promise.resolve(record);
    },
  ),
  delete: jest.fn(({ where }: { where: { id: string } }) => {
    const record = mockAnalysisCategories.find((entry) => entry.id === where.id);

    if (!record) {
      throw new Error('Analysis category not found');
    }

    mockAnalysisCategories = mockAnalysisCategories.filter((entry) => entry.id !== where.id);
    return Promise.resolve(record);
  }),
};

const mockAnalysisAddOnDelegate = {
  findMany: jest.fn(
    ({
      orderBy,
    }: {
      orderBy?: Array<{ name?: 'asc' | 'desc' }>;
    } = {}) => {
      const records = [...mockAnalysisAddOns];

      if (orderBy?.[0]?.name) {
        records.sort((left, right) =>
          orderBy[0].name === 'asc'
            ? left.name.localeCompare(right.name)
            : right.name.localeCompare(left.name),
        );
      }

      return Promise.resolve(records);
    },
  ),
  findUnique: jest.fn(({ where }: { where: { id?: string; slug?: string } }) =>
    Promise.resolve(
      mockAnalysisAddOns.find((entry) => (where.id ? entry.id === where.id : entry.slug === where.slug)) ??
        null,
    ),
  ),
  findFirst: jest.fn(
    ({
      where,
    }: {
      where?: {
        slug?: string;
        NOT?: { id?: string };
      };
    }) =>
      Promise.resolve(
        mockAnalysisAddOns.find((entry) => {
          if (where?.slug && entry.slug !== where.slug) {
            return false;
          }

          if (where?.NOT?.id && entry.id === where.NOT.id) {
            return false;
          }

          return true;
        }) ?? null,
      ),
  ),
  create: jest.fn(
    ({
      data,
    }: {
      data: Omit<MockAnalysisAddOnRecord, 'id' | 'createdAt' | 'updatedAt'>;
    }) => {
      const record: MockAnalysisAddOnRecord = {
        id: `analysis_add_on_${mockAnalysisAddOns.length + 1}`,
        slug: data.slug,
        name: data.name,
        description: data.description ?? null,
        priceCents: data.priceCents,
        isActive: data.isActive,
        createdAt: new Date('2026-04-16T00:00:00.000Z'),
        updatedAt: new Date('2026-04-16T00:00:00.000Z'),
      };

      mockAnalysisAddOns.push(record);
      return Promise.resolve(record);
    },
  ),
  update: jest.fn(
    ({
      where,
      data,
    }: {
      where: { id: string };
      data: Partial<MockAnalysisAddOnRecord>;
    }) => {
      const record = mockAnalysisAddOns.find((entry) => entry.id === where.id);

      if (!record) {
        throw new Error('Analysis add-on not found');
      }

      Object.assign(record, data);
      record.updatedAt = new Date('2026-04-16T00:00:00.000Z');
      return Promise.resolve(record);
    },
  ),
  delete: jest.fn(({ where }: { where: { id: string } }) => {
    const record = mockAnalysisAddOns.find((entry) => entry.id === where.id);

    if (!record) {
      throw new Error('Analysis add-on not found');
    }

    mockAnalysisAddOns = mockAnalysisAddOns.filter((entry) => entry.id !== where.id);
    return Promise.resolve(record);
  }),
};

const mockAnalysisTicketDelegate = {
  findUnique: jest.fn(({ where }: { where: { id: string } }) =>
    Promise.resolve(mockAnalysisTickets.find((entry) => entry.id === where.id) ?? null),
  ),
  create: jest.fn(
    ({
      data,
    }: {
      data: Omit<
        MockAnalysisTicketRecord,
        | 'id'
        | 'assignedExpertUserId'
        | 'quotePriceCents'
        | 'quoteNote'
        | 'quotedAt'
        | 'customerApprovedAt'
        | 'revisionCount'
        | 'maxRevisions'
        | 'rating'
        | 'ratingComment'
        | 'ratedAt'
        | 'deadlineAt'
        | 'assignedAt'
        | 'closedAt'
        | 'lastActivityAt'
        | 'metadata'
        | 'createdAt'
        | 'updatedAt'
      > & {
        assignedExpertUserId?: string | null;
        quotePriceCents?: number | null;
        quoteNote?: string | null;
        quotedAt?: Date | null;
        customerApprovedAt?: Date | null;
        revisionCount?: number;
        maxRevisions?: number;
        rating?: number | null;
        ratingComment?: string | null;
        ratedAt?: Date | null;
        deadlineAt?: Date | null;
        assignedAt?: Date | null;
        closedAt?: Date | null;
        lastActivityAt?: Date;
        metadata?: Record<string, unknown> | null;
      };
    }) => {
      const record: MockAnalysisTicketRecord = {
        id: `analysis_ticket_${mockAnalysisTickets.length + 1}`,
        ticketNumber: data.ticketNumber,
        customerUserId: data.customerUserId,
        assignedExpertUserId: data.assignedExpertUserId ?? null,
        categorySlug: data.categorySlug,
        categoryNameSnapshot: data.categoryNameSnapshot,
        title: data.title,
        brief: data.brief,
        status: data.status,
        deliveryMode: data.deliveryMode,
        quotePriceCents: data.quotePriceCents ?? null,
        quoteNote: data.quoteNote ?? null,
        quotedAt: data.quotedAt ?? null,
        customerApprovedAt: data.customerApprovedAt ?? null,
        revisionCount: data.revisionCount ?? 0,
        maxRevisions: data.maxRevisions ?? 2,
        rating: data.rating ?? null,
        ratingComment: data.ratingComment ?? null,
        ratedAt: data.ratedAt ?? null,
        deadlineAt: data.deadlineAt ?? null,
        assignedAt: data.assignedAt ?? null,
        closedAt: data.closedAt ?? null,
        lastActivityAt: data.lastActivityAt ?? new Date('2026-04-16T00:00:00.000Z'),
        metadata: data.metadata ?? null,
        createdAt: new Date('2026-04-16T00:00:00.000Z'),
        updatedAt: new Date('2026-04-16T00:00:00.000Z'),
      };

      mockAnalysisTickets.push(record);
      return Promise.resolve(record);
    },
  ),
  update: jest.fn(
    ({
      where,
      data,
    }: {
      where: { id: string };
      data: Partial<MockAnalysisTicketRecord>;
    }) => {
      const record = mockAnalysisTickets.find((entry) => entry.id === where.id);

      if (!record) {
        throw new Error('Analysis ticket not found');
      }

      Object.assign(record, data);
      record.updatedAt = new Date('2026-04-16T00:00:00.000Z');
      return Promise.resolve(record);
    },
  ),
  findMany: jest.fn(
    ({
      where,
      orderBy,
      skip,
      take,
    }: {
      where?: Record<string, unknown>;
      orderBy?: Record<string, string>;
      skip?: number;
      take?: number;
    } = {}) => {
      let records = [...mockAnalysisTickets];

      if (where) {
        if (where.customerUserId) records = records.filter((r) => r.customerUserId === where.customerUserId);
        if (where.assignedExpertUserId) records = records.filter((r) => r.assignedExpertUserId === where.assignedExpertUserId);
        if (where.status) records = records.filter((r) => r.status === where.status);
        if (where.categorySlug) records = records.filter((r) => r.categorySlug === where.categorySlug);
        if (where.deliveryMode) records = records.filter((r) => r.deliveryMode === where.deliveryMode);
      }

      if (orderBy && 'createdAt' in orderBy && orderBy.createdAt === 'desc') {
        records.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      }

      if (typeof skip === 'number') records = records.slice(skip);
      if (typeof take === 'number') records = records.slice(0, take);

      return Promise.resolve(records);
    },
  ),
  count: jest.fn(
    ({ where }: { where?: Record<string, unknown> } = {}) => {
      let records = [...mockAnalysisTickets];

      if (where) {
        if (where.customerUserId) records = records.filter((r) => r.customerUserId === where.customerUserId);
        if (where.assignedExpertUserId) records = records.filter((r) => r.assignedExpertUserId === where.assignedExpertUserId);
        if (where.status) records = records.filter((r) => r.status === where.status);
      }

      return Promise.resolve(records.length);
    },
  ),
  aggregate: jest.fn(
    ({ where }: { where?: Record<string, unknown> }) => {
      const records = mockAnalysisTickets.filter((r) => {
        if (where?.assignedExpertUserId && r.assignedExpertUserId !== where.assignedExpertUserId) return false;
        if (where?.ratedAt && r.ratedAt === null) return false;
        if (where?.rating && r.rating === null) return false;
        return true;
      });

      const ratings = records.filter((r) => r.rating !== null).map((r) => r.rating as number);
      const avg = ratings.length > 0 ? ratings.reduce((a, b) => a + b, 0) / ratings.length : null;

      return Promise.resolve({ _avg: { rating: avg } });
    },
  ),
};

const mockTicketFileDelegate = {
  create: jest.fn(
    ({
      data,
    }: {
      data: Omit<MockTicketFileRecord, 'id' | 'metadata' | 'createdAt'> & {
        metadata?: Record<string, unknown> | null;
      };
    }) => {
      const record: MockTicketFileRecord = {
        id: `ticket_file_${mockTicketFiles.length + 1}`,
        ticketId: data.ticketId,
        uploadedByUserId: data.uploadedByUserId,
        fileType: data.fileType,
        storageKey: data.storageKey,
        originalFileName: data.originalFileName,
        mimeType: data.mimeType,
        sizeBytes: data.sizeBytes,
        metadata: data.metadata ?? null,
        createdAt: new Date('2026-04-16T00:00:00.000Z'),
      };

      mockTicketFiles.push(record);
      return Promise.resolve(record);
    },
  ),
  findMany: jest.fn(
    ({ where, orderBy }: { where?: { ticketId?: string }; orderBy?: Record<string, string> } = {}) => {
      let records = [...mockTicketFiles];

      if (where?.ticketId) records = records.filter((r) => r.ticketId === where.ticketId);

      if (orderBy && 'createdAt' in orderBy && orderBy.createdAt === 'asc') {
        records.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
      }

      return Promise.resolve(records);
    },
  ),
};

const mockExpertProfileDelegate = {
  findUnique: jest.fn(
    ({ where }: { where: { id?: string; userId?: string } }) =>
      Promise.resolve(
        mockExpertProfiles.find((entry) =>
          where.id ? entry.id === where.id : entry.userId === where.userId,
        ) ?? null,
      ),
  ),
  findMany: jest.fn(
    ({
      where,
    }: {
      where?: {
        isAvailable?: boolean;
      };
    } = {}) => {
      let records = [...mockExpertProfiles];

      if (typeof where?.isAvailable === 'boolean') {
        records = records.filter((entry) => entry.isAvailable === where.isAvailable);
      }

      return Promise.resolve(
        records.map((record) => ({
          ...record,
          tags: mockExpertiseTags.filter((tag) => tag.expertProfileId === record.id),
        })),
      );
    },
  ),
  update: jest.fn(
    ({
      where,
      data,
    }: {
      where: { id: string };
      data: Partial<MockExpertProfileRecord>;
    }) => {
      const record = mockExpertProfiles.find((entry) => entry.id === where.id);

      if (!record) {
        throw new Error('Expert profile not found');
      }

      Object.assign(record, data);
      record.updatedAt = new Date('2026-04-16T00:00:00.000Z');
      return Promise.resolve(record);
    },
  ),
  updateMany: jest.fn(
    ({ where, data }: { where: { userId: string }; data: Partial<MockExpertProfileRecord> }) => {
      const record = mockExpertProfiles.find((entry) => entry.userId === where.userId);

      if (record) {
        Object.assign(record, data);
        record.updatedAt = new Date('2026-04-16T00:00:00.000Z');
      }

      return Promise.resolve({ count: record ? 1 : 0 });
    },
  ),
};

const mockNdaAgreementDelegate = {
  findUnique: jest.fn(({ where }: { where: { ticketId?: string; id?: string } }) =>
    Promise.resolve(
      mockNdaAgreements.find((entry) =>
        where.ticketId ? entry.ticketId === where.ticketId : entry.id === where.id,
      ) ?? null,
    ),
  ),
  upsert: jest.fn(
    ({
      where,
      create,
      update,
    }: {
      where: { ticketId: string };
      create: Omit<MockNdaAgreementRecord, 'id' | 'agreedAt' | 'createdAt'> & {
        agreedAt?: Date | null;
      };
      update: Partial<MockNdaAgreementRecord>;
    }) => {
      const existing = mockNdaAgreements.find((entry) => entry.ticketId === where.ticketId);

      if (existing) {
        Object.assign(existing, update);
        return Promise.resolve(existing);
      }

      const record: MockNdaAgreementRecord = {
        id: `nda_${mockNdaAgreements.length + 1}`,
        ticketId: create.ticketId,
        expertUserId: create.expertUserId,
        agreedAt: create.agreedAt ?? null,
        documentStorageKey: create.documentStorageKey ?? null,
        createdAt: new Date('2026-04-16T00:00:00.000Z'),
      };

      mockNdaAgreements.push(record);
      return Promise.resolve(record);
    },
  ),
  update: jest.fn(
    ({
      where,
      data,
    }: {
      where: { id: string };
      data: Partial<MockNdaAgreementRecord>;
    }) => {
      const record = mockNdaAgreements.find((entry) => entry.id === where.id);

      if (!record) {
        throw new Error('NDA agreement not found');
      }

      Object.assign(record, data);
      return Promise.resolve(record);
    },
  ),
};

const mockTicketMessageDelegate = {
  create: jest.fn(
    ({
      data,
    }: {
      data: {
        ticketId: string;
        senderUserId?: string | null;
        senderType: 'CUSTOMER' | 'EXPERT' | 'SYSTEM';
        body: string;
        metadata?: Record<string, unknown> | null;
      };
    }) => {
      const record: MockTicketMessageRecord = {
        id: `ticket_message_${mockTicketMessages.length + 1}`,
        ticketId: data.ticketId,
        senderUserId: data.senderUserId ?? null,
        senderType: data.senderType,
        body: data.body,
        metadata: (data.metadata as Record<string, unknown>) ?? null,
        createdAt: new Date('2026-04-16T00:00:00.000Z'),
      };

      mockTicketMessages.push(record);
      return Promise.resolve(record);
    },
  ),
  findMany: jest.fn(
    ({ where, orderBy }: { where?: { ticketId?: string }; orderBy?: Record<string, string> } = {}) => {
      let records = [...mockTicketMessages];

      if (where?.ticketId) records = records.filter((r) => r.ticketId === where.ticketId);

      if (orderBy && 'createdAt' in orderBy && orderBy.createdAt === 'asc') {
        records.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
      }

      return Promise.resolve(records);
    },
  ),
};

const mockDocumentSectionDelegate = {
  deleteMany: jest.fn(
    ({ where }: { where: { documentId: string; documentVersionId?: string } }) => {
      const before = mockDocumentSections.length;
      mockDocumentSections = mockDocumentSections.filter(
        (entry) =>
          !(
            entry.documentId === where.documentId &&
            (typeof where.documentVersionId === 'undefined' ||
              entry.documentVersionId === where.documentVersionId)
          ),
      );
      return Promise.resolve({ count: before - mockDocumentSections.length });
    },
  ),
  createMany: jest.fn(
    ({
      data,
    }: {
      data: Array<{
        documentId: string;
        documentVersionId: string;
        sectionType: string;
        title: string | null;
        content: Record<string, unknown> | null;
        orderIndex: number;
        level: number | null;
        confidenceScore: number | null;
      }>;
    }) => {
      const createdAt = new Date('2026-04-14T00:00:00.000Z');
      for (const entry of data) {
        mockDocumentSections.push({
          id: `document_section_${++documentSectionSequence}`,
          documentId: entry.documentId,
          documentVersionId: entry.documentVersionId,
          parentSectionId: null,
          sectionType: entry.sectionType,
          title: entry.title,
          content: entry.content,
          orderIndex: entry.orderIndex,
          level: entry.level,
          confidenceScore: entry.confidenceScore,
          createdAt,
          updatedAt: createdAt,
        });
      }

      return Promise.resolve({ count: data.length });
    },
  ),
  findMany: jest.fn(
    ({
      where,
    }: {
      where: { documentId: string; documentVersionId?: string };
      orderBy?: Array<{ orderIndex?: 'asc'; createdAt?: 'asc' }>;
    }) =>
      Promise.resolve(
        mockDocumentSections
          .filter(
            (entry) =>
              entry.documentId === where.documentId &&
              (typeof where.documentVersionId === 'undefined' ||
                entry.documentVersionId === where.documentVersionId),
          )
          .sort((left, right) => left.orderIndex - right.orderIndex),
      ),
  ),
};

const mockDocumentUploadSessionDelegate = {
  create: jest.fn(
    ({
      data,
    }: {
      data: Omit<
        MockDocumentUploadSessionRecord,
        'id' | 'documentId' | 'createdAt' | 'updatedAt'
      > & { documentId?: string | null };
    }) => {
      const record: MockDocumentUploadSessionRecord = {
        id: `upload_session_${++documentUploadSessionSequence}`,
        userId: data.userId,
        documentId: data.documentId ?? null,
        fileName: data.fileName,
        mimeType: data.mimeType,
        sizeBytes: data.sizeBytes,
        storageKey: data.storageKey,
        status: data.status,
        progress: data.progress,
        expiresAt: data.expiresAt,
        createdAt: new Date('2026-04-14T00:00:00.000Z'),
        updatedAt: new Date('2026-04-14T00:00:00.000Z'),
      };

      mockDocumentUploadSessions.push(record);
      return Promise.resolve(record);
    },
  ),
  findUnique: jest.fn(({ where }: { where: { id: string } }) =>
    Promise.resolve(mockDocumentUploadSessions.find((entry) => entry.id === where.id) ?? null),
  ),
  update: jest.fn(
    ({
      where,
      data,
    }: {
      where: { id: string };
      data: Partial<MockDocumentUploadSessionRecord>;
    }) => {
      const record = mockDocumentUploadSessions.find((entry) => entry.id === where.id);
      if (!record) {
        throw new Error('Document upload session not found');
      }

      Object.assign(record, data);
      record.updatedAt = new Date('2026-04-14T00:00:00.000Z');
      return Promise.resolve(record);
    },
  ),
};

const redisMock = {
  getClient: () => ({
    set: jest.fn((key: string, value: string) => {
      redisStore.set(key, value);
      return Promise.resolve('OK');
    }),
    get: jest.fn((key: string) => Promise.resolve(redisStore.get(key) ?? null)),
    del: jest.fn((key: string) => {
      redisStore.delete(key);
      return Promise.resolve(1);
    }),
    incr: jest.fn((key: string) => {
      const current = Number(redisStore.get(key) ?? '0') + 1;
      redisStore.set(key, String(current));
      return Promise.resolve(current);
    }),
    expire: jest.fn(() => Promise.resolve(1)),
  }),
} as unknown as RedisService;

const uploadedObjects = new Map<string, { contentType: string; size: number }>();
const queuedVirusScans: Array<{
  documentId: string;
  documentVersionId?: string;
  storageKey?: string;
  stage: 'virus-scan';
  requestedBy: string;
}> = [];
const queuedParses: Array<{
  documentId: string;
  documentVersionId?: string;
  storageKey?: string;
  stage: 'parse';
  requestedBy: string;
}> = [];
const queuedPdfConversions: Array<{
  documentId: string;
  documentVersionId?: string;
  stage: 'pdf-convert';
  requestedBy: string;
}> = [];

const storageMock = {
  uploadObject: jest.fn(
    ({ key, body, contentType }: { key: string; body: Buffer; contentType: string }) => {
      uploadedObjects.set(key, {
        contentType,
        size: body.byteLength,
      });
      return Promise.resolve({
        bucket: 'formatedit',
        key,
        provider: 'minio',
      });
    },
  ),
  createPresignedUploadUrl: jest.fn((key: string) =>
    Promise.resolve({
      bucket: 'formatedit',
      key,
      provider: 'minio',
      url: `https://example.com/upload/${key}`,
      expiresIn: 900,
      operation: 'upload',
    }),
  ),
  createPresignedDownloadUrl: jest.fn((key: string) =>
    Promise.resolve({
      bucket: 'formatedit',
      key,
      provider: 'minio',
      url: `https://example.com/download/${key}`,
      expiresIn: 900,
      operation: 'download',
    }),
  ),
  downloadObject: jest.fn((key: string) =>
    Promise.resolve({
      bucket: 'formatedit',
      key,
      provider: 'minio',
      body: Buffer.from('fake-docx-content'),
      contentType: key.endsWith('.pdf')
        ? 'application/pdf'
        : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    }),
  ),
} as unknown as StorageService;

const queueMock = {
  enqueueVirusScanJob: jest.fn(
    (payload: {
      documentId: string;
      documentVersionId?: string;
      storageKey?: string;
      stage: 'virus-scan';
      requestedBy: string;
    }) => {
      queuedVirusScans.push(payload);
      return Promise.resolve({
        id: `${queuedVirusScans.length}`,
        name: `virus-scan:${payload.documentId}`,
        data: payload,
      });
    },
  ),
  enqueueDocumentPipelineJob: jest.fn((payload: { documentId: string; stage: 'preview'; requestedBy: string }) =>
    Promise.resolve({
      id: `preview_${payload.documentId}`,
      name: `${payload.stage}:${payload.documentId}`,
      data: payload,
    }),
  ),
  enqueueParseJob: jest.fn(
    (payload: {
      documentId: string;
      documentVersionId?: string;
      storageKey?: string;
      stage: 'parse';
      requestedBy: string;
    }) => {
      queuedParses.push(payload);
      return Promise.resolve({
        id: `parse_${payload.documentId}`,
        name: `${payload.stage}:${payload.documentId}`,
        data: payload,
      });
    },
  ),
  enqueuePdfConversionJob: jest.fn(
    (payload: {
      documentId: string;
      documentVersionId?: string;
      stage: 'pdf-convert';
      requestedBy: string;
    }) => {
      queuedPdfConversions.push(payload);
      return Promise.resolve({
        id: `pdf_convert_${payload.documentId}`,
        name: `${payload.stage}:${payload.documentId}`,
        data: payload,
      });
    },
  ),
  getDocumentPipelineSnapshot: jest.fn((documentId: string) =>
    Promise.resolve({
      parsePending: queuedParses.filter((entry) => entry.documentId === documentId).length,
      pdfConversionPending: queuedPdfConversions.filter((entry) => entry.documentId === documentId)
        .length,
    }),
  ),
  createDocumentPipelineWorker: jest.fn(() => ({
    close: jest.fn(() => Promise.resolve()),
  })),
  createFormattingWorker: jest.fn(() => ({
    close: jest.fn(() => Promise.resolve()),
  })),
} as unknown as QueueService;

describe('App module bootstrap', () => {
  let app: INestApplication;
  const transactionFn: jest.Mock = jest.fn();
  const prismaMock = {
    user: mockUserDelegate,
    refreshToken: mockRefreshTokenDelegate,
    oAuthAccount: mockOAuthAccountDelegate,
    twoFactorMethod: mockTwoFactorMethodDelegate,
    notificationPreference: mockNotificationPreferenceDelegate,
    impersonationSession: mockImpersonationSessionDelegate,
    auditLog: mockAuditLogDelegate,
    auditRetentionSetting: mockAuditRetentionSettingDelegate,
    document: mockDocumentDelegate,
    documentVersion: mockDocumentVersionDelegate,
    documentSection: mockDocumentSectionDelegate,
    documentSecuritySetting: mockDocumentSecuritySettingDelegate,
    systemSetting: mockSystemSettingDelegate,
    documentUploadSession: mockDocumentUploadSessionDelegate,
    template: mockTemplateDelegate,
    userTemplate: mockUserTemplateDelegate,
    workTypeSetting: mockWorkTypeSettingDelegate,
    analysisCategory: mockAnalysisCategoryDelegate,
    analysisAddOn: mockAnalysisAddOnDelegate,
    analysisTicket: mockAnalysisTicketDelegate,
    ticketFile: mockTicketFileDelegate,
    expertProfile: mockExpertProfileDelegate,
    ndaAgreement: mockNdaAgreementDelegate,
    ticketMessage: mockTicketMessageDelegate,
    $transaction: transactionFn,
  } as unknown as PrismaService;
  transactionFn.mockImplementation(
    (handler: (tx: PrismaService) => Promise<unknown>) => handler(prismaMock),
  );

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.PORT = '3001';
    process.env.APP_URL = 'http://localhost:3000';
    process.env.API_URL = 'http://localhost:3001';
    process.env.DATABASE_URL = 'postgresql://postgres:postgres@localhost:5432/formatedit?schema=public';
    process.env.REDIS_URL = 'redis://localhost:6379';
    process.env.JWT_SECRET = 'test-secret';
    process.env.JWT_ACCESS_TOKEN_TTL = '15m';
    process.env.JWT_REFRESH_TOKEN_TTL = '7d';
    process.env.TWO_FACTOR_CODE_TTL_SECONDS = '300';
    process.env.AUDIT_RETENTION_DAYS = '180';
    process.env.AUDIT_RETENTION_JOB_INTERVAL_MINUTES = '60';
    process.env.DEFAULT_MAX_UPLOAD_SIZE_BYTES = '10485760';
    process.env.CLAMAV_HOST = 'clamav';
    process.env.CLAMAV_PORT = '3310';
    process.env.VIRUSTOTAL_API_KEY = '';
    process.env.DOCX_AI_HEADING_ENABLED = 'false';
    process.env.STORAGE_PROVIDER = 'minio';
    process.env.S3_REGION = 'us-east-1';
    process.env.MINIO_BUCKET = 'formatedit';
    process.env.MINIO_ENDPOINT = 'http://localhost:9000';
    process.env.S3_ACCESS_KEY_ID = 'minioadmin';
    process.env.S3_SECRET_ACCESS_KEY = 'minioadmin';
    process.env.QUEUE_PREFIX = 'formatedit-test';
    process.env.GOOGLE_CLIENT_ID = 'google-client-id';
    process.env.GOOGLE_CLIENT_SECRET = 'google-client-secret';
    process.env.GOOGLE_CALLBACK_URL = 'http://localhost:3001/auth/google/callback';
    existingUserPasswordHash = await bcrypt.hash('supersecret', 4);

    const { AppModule } = await import('../src/app.module');
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(prismaMock)
      .overrideProvider(RedisService)
      .useValue(redisMock)
      .overrideProvider(StorageService)
      .useValue(storageMock)
      .overrideProvider(QueueService)
      .useValue(queueMock)
      .overrideProvider(PasswordService)
      .useValue({
        hashPassword: (value: string) => bcrypt.hash(value, 4),
        verifyPassword: (value: string, hash: string) => bcrypt.compare(value, hash),
        hashOneTimeCode: (value: string) => bcrypt.hash(value, 4),
        verifyOneTimeCode: (value: string, hash: string) => bcrypt.compare(value, hash),
        generateOneTimeCode: () => testTwoFactorCode,
      })
      .compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(createGlobalValidationPipe());
    app.useGlobalFilters(new GlobalExceptionFilter());
    await app.init();
  });

  beforeEach(() => {
    refreshTokenSequence = 0;
    twoFactorMethodSequence = 0;
    notificationPreferenceSequence = 2;
    impersonationSequence = 0;
    auditLogSequence = 0;
    documentSequence = 0;
    documentVersionSequence = 0;
    documentSectionSequence = 0;
    documentUploadSessionSequence = 0;
    templateSequence = 0;
    userTemplateSequence = 0;
    redisStore.clear();
    uploadedObjects.clear();
    queuedVirusScans.length = 0;
    queuedParses.length = 0;
    queuedPdfConversions.length = 0;
    mockRefreshTokens = [];
    mockTwoFactorMethods = [];
    mockImpersonationSessions = [];
    mockAuditLogs = [];
    mockDocuments = [];
    mockDocumentVersions = [];
    mockDocumentSections = [];
    mockDocumentUploadSessions = [];
    mockTemplates = [
      {
        id: 'template_1',
        slug: 'nku-thesis',
        name: 'NKU Thesis',
        description: 'Official thesis template',
        category: 'University',
        workType: 'thesis',
        isActive: true,
        isArchived: false,
        version: 1,
        usageCount: 0,
        templateParameters: defaultTemplateParameters,
        createdByUserId: 'admin_user',
        sourceUserTemplateId: null,
        previousVersionId: null,
        createdAt: new Date('2026-04-14T00:00:00.000Z'),
        updatedAt: new Date('2026-04-14T00:00:00.000Z'),
      },
    ];
    templateSequence = mockTemplates.length;
    mockUserTemplates = [];
    mockWorkTypeSettings = [
      {
        id: 'work_type_1',
        slug: 'thesis',
        label: 'Thesis',
        isActive: true,
        requiredFixedPages: ['abstract'],
        optionalFixedPages: ['acknowledgements', 'cv'],
        createdAt: new Date('2026-04-14T00:00:00.000Z'),
        updatedAt: new Date('2026-04-14T00:00:00.000Z'),
      },
      {
        id: 'work_type_2',
        slug: 'article',
        label: 'Article',
        isActive: true,
        requiredFixedPages: ['abstract'],
        optionalFixedPages: ['acknowledgements'],
        createdAt: new Date('2026-04-14T00:00:00.000Z'),
        updatedAt: new Date('2026-04-14T00:00:00.000Z'),
      },
    ];
    mockAnalysisCategories = [
      {
        id: 'analysis_category_1',
        slug: 'statistical-analysis',
        name: 'Statistical Analysis',
        description: 'SPSS, regression, and interpretation support.',
        isActive: true,
        sortOrder: 10,
        createdAt: new Date('2026-04-16T00:00:00.000Z'),
        updatedAt: new Date('2026-04-16T00:00:00.000Z'),
      },
      {
        id: 'analysis_category_2',
        slug: 'qualitative-coding',
        name: 'Qualitative Coding',
        description: 'Interview coding and thematic analysis.',
        isActive: false,
        sortOrder: 20,
        createdAt: new Date('2026-04-16T00:00:00.000Z'),
        updatedAt: new Date('2026-04-16T00:00:00.000Z'),
      },
    ];
    mockAnalysisAddOns = [
      {
        id: 'analysis_add_on_1',
        slug: 'rush-delivery',
        name: 'Rush Delivery',
        description: 'Priority scheduling within 24 hours.',
        priceCents: 150000,
        isActive: true,
        createdAt: new Date('2026-04-16T00:00:00.000Z'),
        updatedAt: new Date('2026-04-16T00:00:00.000Z'),
      },
      {
        id: 'analysis_add_on_2',
        slug: 'extra-revision',
        name: 'Extra Revision',
        description: 'One additional revision round.',
        priceCents: 50000,
        isActive: false,
        createdAt: new Date('2026-04-16T00:00:00.000Z'),
        updatedAt: new Date('2026-04-16T00:00:00.000Z'),
      },
    ];
    mockAnalysisTickets = [];
    mockTicketFiles = [];
    mockExpertProfiles = [
      {
        id: 'expert_profile_1',
        userId: 'expert_user_1',
        bio: 'SPSS specialist',
        maxConcurrent: 3,
        activeTickets: 2,
        isAvailable: true,
        averageRating: 4.6,
        totalCompleted: 14,
        createdAt: new Date('2026-04-16T00:00:00.000Z'),
        updatedAt: new Date('2026-04-16T00:00:00.000Z'),
      },
      {
        id: 'expert_profile_2',
        userId: 'expert_user_2',
        bio: 'Regression and correlation specialist',
        maxConcurrent: 3,
        activeTickets: 1,
        isAvailable: true,
        averageRating: 4.8,
        totalCompleted: 11,
        createdAt: new Date('2026-04-16T00:00:00.000Z'),
        updatedAt: new Date('2026-04-16T00:00:00.000Z'),
      },
    ];
    mockExpertiseTags = [
      {
        id: 'expertise_tag_1',
        expertProfileId: 'expert_profile_1',
        categorySlug: 'statistical-analysis',
        createdAt: new Date('2026-04-16T00:00:00.000Z'),
      },
      {
        id: 'expertise_tag_2',
        expertProfileId: 'expert_profile_2',
        categorySlug: 'statistical-analysis',
        createdAt: new Date('2026-04-16T00:00:00.000Z'),
      },
    ];
    mockNdaAgreements = [];
    mockTicketMessages = [];
    mockAuditRetentionSetting = {
      id: 'default',
      retentionDays: 180,
      isEnabled: true,
      createdAt: new Date('2026-04-13T00:00:00.000Z'),
      updatedAt: new Date('2026-04-13T00:00:00.000Z'),
    };
    mockDocumentSecuritySetting = {
      id: 'default',
      maxUploadSizeBytes: 10 * 1024 * 1024,
      clamAvEnabled: false,
      virusTotalEnabled: false,
      createdAt: new Date('2026-04-14T00:00:00.000Z'),
      updatedAt: new Date('2026-04-14T00:00:00.000Z'),
    };
    mockSystemSettings = [];
    mockUsers = [
      {
        id: 'existing_user',
        email: 'existing@example.com',
        passwordHash: existingUserPasswordHash,
        fullName: 'Existing User',
        role: 'USER',
        academicTitle: 'UNDERGRADUATE',
        preferredLanguage: 'tr',
        themePreference: 'SYSTEM',
        createdAt: new Date('2026-04-13T00:00:00.000Z'),
        deletedAt: null,
        anonymizedAt: null,
      },
      {
        id: 'admin_user',
        email: 'admin@example.com',
        passwordHash: existingUserPasswordHash,
        fullName: 'Admin User',
        role: 'ADMIN',
        academicTitle: 'PROFESSOR',
        preferredLanguage: 'en',
        themePreference: 'DARK',
        createdAt: new Date('2026-04-13T00:00:00.000Z'),
        deletedAt: null,
        anonymizedAt: null,
      },
      {
        id: 'expert_user_1',
        email: 'expert1@example.com',
        passwordHash: existingUserPasswordHash,
        fullName: 'Expert One',
        role: 'EXPERT',
        academicTitle: 'LECTURER',
        preferredLanguage: 'tr',
        themePreference: 'SYSTEM',
        createdAt: new Date('2026-04-13T00:00:00.000Z'),
        deletedAt: null,
        anonymizedAt: null,
      },
      {
        id: 'expert_user_2',
        email: 'expert2@example.com',
        passwordHash: existingUserPasswordHash,
        fullName: 'Expert Two',
        role: 'EXPERT',
        academicTitle: 'LECTURER',
        preferredLanguage: 'tr',
        themePreference: 'SYSTEM',
        createdAt: new Date('2026-04-13T00:00:00.000Z'),
        deletedAt: null,
        anonymizedAt: null,
      },
    ];
    mockNotificationPreferences = [
      {
        id: 'notification_1',
        userId: 'existing_user',
        emailEnabled: true,
        inAppEnabled: true,
        whatsappEnabled: false,
        telegramEnabled: false,
        createdAt: new Date('2026-04-13T00:00:00.000Z'),
        updatedAt: new Date('2026-04-13T00:00:00.000Z'),
      },
      {
        id: 'notification_2',
        userId: 'admin_user',
        emailEnabled: true,
        inAppEnabled: true,
        whatsappEnabled: true,
        telegramEnabled: true,
        createdAt: new Date('2026-04-13T00:00:00.000Z'),
        updatedAt: new Date('2026-04-13T00:00:00.000Z'),
      },
    ];

    mockOAuthAccountDelegate.findUnique.mockResolvedValue(null);
    mockOAuthAccountDelegate.upsert.mockResolvedValue(null);
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  async function loginAs(email: string): Promise<AuthSession> {
    const server = app.getHttpServer() as Parameters<typeof request>[0];
    const response = await request(server).post('/auth/login').send({
      email,
      password: 'supersecret',
    });

    expect(response.status).toBe(201);
    return response.body as AuthSession;
  }

  it('returns root application status with request id header', async () => {
    const server = app.getHttpServer() as Parameters<typeof request>[0];
    const response = await request(server).get('/').set('x-request-id', 'req-root-test');

    expect(response.status).toBe(200);
    expect(response.headers['x-request-id']).toBe('req-root-test');
  });

  it('registers a new user', async () => {
    const server = app.getHttpServer() as Parameters<typeof request>[0];
    const response = await request(server).post('/auth/register').send({
      email: 'User@Example.com',
      password: 'supersecret',
      academicTitle: 'MASTERS_STUDENT',
    });

    const body = response.body as MinimalUserResponse;

    expect(response.status).toBe(201);
    expect(body.email).toBe('user@example.com');
  });

  it('returns current user for valid access token', async () => {
    const server = app.getHttpServer() as Parameters<typeof request>[0];
    const session = await loginAs('existing@example.com');

    const response = await request(server)
      .get('/auth/me')
      .set('authorization', `Bearer ${session.tokens.accessToken}`);

    const body = response.body as MinimalUserResponse;

    expect(response.status).toBe(200);
    expect(body.email).toBe('existing@example.com');
  });

  it('supports authenticator setup and verification', async () => {
    const server = app.getHttpServer() as Parameters<typeof request>[0];
    const session = await loginAs('existing@example.com');

    const setupResponse = await request(server)
      .post('/auth/2fa/authenticator/setup')
      .set('authorization', `Bearer ${session.tokens.accessToken}`)
      .send({ label: 'phone-authenticator' });

    const setupBody = setupResponse.body as AuthenticatorSetupResponse;

    expect(setupResponse.status).toBe(201);
    expect(setupBody.method).toBe('AUTHENTICATOR');
    const method = mockTwoFactorMethods.find((entry) => entry.id === setupBody.methodId);
    expect(method?.secret).toEqual(expect.any(String));

    const totpCode = authenticator.generate(method?.secret ?? '');
    const verifyResponse = await request(server)
      .post('/auth/2fa/verify')
      .set('authorization', `Bearer ${session.tokens.accessToken}`)
      .send({
        method: 'AUTHENTICATOR',
        methodId: setupBody.methodId,
        code: totpCode,
      });

    const verifyBody = verifyResponse.body as TwoFactorVerifyResponse;

    expect(verifyResponse.status).toBe(201);
    expect(verifyBody).toEqual({ success: true, method: 'AUTHENTICATOR', verified: true });
    expect(method?.isVerified).toBe(true);
  });

  it('verifies whatsapp channel codes', async () => {
    const server = app.getHttpServer() as Parameters<typeof request>[0];
    const session = await loginAs('existing@example.com');

    await request(server)
      .post('/auth/2fa/whatsapp/send')
      .set('authorization', `Bearer ${session.tokens.accessToken}`)
      .send({ recipient: '+905551112233', label: 'primary-whatsapp' });

    const rawChallenge = redisStore.get('two-factor:existing_user:WHATSAPP:+905551112233');
    expect(rawChallenge).toEqual(expect.any(String));
    const code = testTwoFactorCode;

    const verifyResponse = await request(server)
      .post('/auth/2fa/verify')
      .set('authorization', `Bearer ${session.tokens.accessToken}`)
      .send({ method: 'WHATSAPP', recipient: '+905551112233', code });

    const verifyBody = verifyResponse.body as TwoFactorVerifyResponse;

    expect(verifyResponse.status).toBe(201);
    expect(verifyBody).toEqual({ success: true, method: 'WHATSAPP', verified: true });
    expect(mockTwoFactorMethods[0]?.isVerified).toBe(true);
    expect(redisStore.has('two-factor:existing_user:WHATSAPP:+905551112233')).toBe(false);
  });

  it('starts and stops impersonation sessions', async () => {
    const server = app.getHttpServer() as Parameters<typeof request>[0];
    const adminSession = await loginAs('admin@example.com');

    const startResponse = await request(server)
      .post('/auth/impersonate/existing_user')
      .set('authorization', `Bearer ${adminSession.tokens.accessToken}`)
      .send({ reason: 'Support debug session' });

    const startBody = startResponse.body as ImpersonationStartResponse;

    expect(startResponse.status).toBe(201);
    expect(startBody.targetUser.email).toBe('existing@example.com');
    expect(startBody.bannerMessage).toContain('existing@example.com');
    expect(mockImpersonationSessions).toHaveLength(1);

    const meResponse = await request(server)
      .get('/auth/me')
      .set('authorization', `Bearer ${startBody.accessToken}`);

    const meBody = meResponse.body as MinimalUserResponse;

    expect(meResponse.status).toBe(200);
    expect(meBody.email).toBe('existing@example.com');

    const stopResponse = await request(server)
      .post('/auth/impersonate/stop')
      .set('authorization', `Bearer ${startBody.accessToken}`)
      .send({});
    const stopBody = stopResponse.body as { success: true };

    expect(stopResponse.status).toBe(201);
    expect(stopBody.success).toBe(true);
    expect(mockImpersonationSessions[0]?.endedAt).toBeInstanceOf(Date);
  });

  it('reads and updates profile preferences', async () => {
    const server = app.getHttpServer() as Parameters<typeof request>[0];
    const session = await loginAs('existing@example.com');

    const profileResponse = await request(server)
      .get('/users/me')
      .set('authorization', `Bearer ${session.tokens.accessToken}`);

    expect(profileResponse.status).toBe(200);
    expect(profileResponse.body).toMatchObject({
      email: 'existing@example.com',
      preferredLanguage: 'tr',
      themePreference: 'SYSTEM',
    });

    const updateProfileResponse = await request(server)
      .patch('/users/me')
      .set('authorization', `Bearer ${session.tokens.accessToken}`)
      .send({
        fullName: 'Updated User',
        academicTitle: 'DOCTORAL_STUDENT',
        preferredLanguage: 'en',
        themePreference: 'LIGHT',
      });

    expect(updateProfileResponse.status).toBe(200);
    expect(updateProfileResponse.body).toMatchObject({
      fullName: 'Updated User',
      academicTitle: 'DOCTORAL_STUDENT',
      preferredLanguage: 'en',
      themePreference: 'LIGHT',
    });

    const updatePreferencesResponse = await request(server)
      .patch('/users/me/notification-preferences')
      .set('authorization', `Bearer ${session.tokens.accessToken}`)
      .send({ whatsappEnabled: true, telegramEnabled: true });

    expect(updatePreferencesResponse.status).toBe(200);
    expect(updatePreferencesResponse.body).toMatchObject({
      whatsappEnabled: true,
      telegramEnabled: true,
    });
  });

  it('returns impersonation history in user profile scope', async () => {
    const server = app.getHttpServer() as Parameters<typeof request>[0];
    const adminSession = await loginAs('admin@example.com');
    const userSession = await loginAs('existing@example.com');

    await request(server)
      .post('/auth/impersonate/existing_user')
      .set('authorization', `Bearer ${adminSession.tokens.accessToken}`)
      .send({ reason: 'History visibility check' });

    const historyResponse = await request(server)
      .get('/users/me/impersonation-history')
      .set('authorization', `Bearer ${userSession.tokens.accessToken}`);

    const historyBody = historyResponse.body as Array<{ adminId: string; reason: string }>;

    expect(historyResponse.status).toBe(200);
    expect(historyBody).toHaveLength(1);
    expect(historyBody[0]).toMatchObject({
      adminId: 'admin_user',
      reason: 'History visibility check',
    });
  });

  it('anonymizes the current user account and blocks future access', async () => {
    const server = app.getHttpServer() as Parameters<typeof request>[0];
    const session = await loginAs('existing@example.com');

    const deleteResponse = await request(server)
      .delete('/users/me')
      .set('authorization', `Bearer ${session.tokens.accessToken}`);
    const deleteBody = deleteResponse.body as AccountDeletionResponse;

    expect(deleteResponse.status).toBe(200);
    expect(deleteBody.success).toBe(true);
    expect(typeof deleteBody.anonymizedAt).toBe('string');

    const anonymizedUser = mockUsers.find((entry) => entry.id === 'existing_user');
    expect(anonymizedUser).toBeDefined();
    expect(anonymizedUser?.email).toBe('deleted+existing_user@anonymized.local');
    expect(anonymizedUser?.fullName).toBeNull();
    expect(anonymizedUser?.deletedAt).toBeInstanceOf(Date);
    expect(anonymizedUser?.anonymizedAt).toBeInstanceOf(Date);

    const protectedResponse = await request(server)
      .get('/users/me')
      .set('authorization', `Bearer ${session.tokens.accessToken}`);

    expect(protectedResponse.status).toBe(401);

    const loginResponse = await request(server).post('/auth/login').send({
      email: 'existing@example.com',
      password: 'supersecret',
    });

    expect(loginResponse.status).toBe(401);
  });

  it('allows admin to read arbitrary user profile by id', async () => {
    const server = app.getHttpServer() as Parameters<typeof request>[0];
    const adminSession = await loginAs('admin@example.com');

    const response = await request(server)
      .get('/users/existing_user')
      .set('authorization', `Bearer ${adminSession.tokens.accessToken}`);

    const body = response.body as MinimalUserResponse;

    expect(response.status).toBe(200);
    expect(body.email).toBe('existing@example.com');
  });

  it('lists and exports audit logs for admins', async () => {
    const server = app.getHttpServer() as Parameters<typeof request>[0];
    const adminSession = await loginAs('admin@example.com');

    await request(server)
      .patch('/users/me')
      .set('authorization', `Bearer ${adminSession.tokens.accessToken}`)
      .set('x-request-id', 'req-audit-list')
      .send({
        fullName: 'Audited Admin',
        preferredLanguage: 'en',
      });

    const listResponse = await request(server)
      .get('/admin/audit-logs')
      .query({ category: 'users', limit: 20 })
      .set('authorization', `Bearer ${adminSession.tokens.accessToken}`);

    expect(listResponse.status).toBe(200);
    expect(listResponse.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          category: 'users',
        }),
      ]),
    );

    const exportResponse = await request(server)
      .get('/admin/audit-logs/export')
      .query({ format: 'csv', limit: 20 })
      .set('authorization', `Bearer ${adminSession.tokens.accessToken}`);

    expect(exportResponse.status).toBe(200);
    expect(exportResponse.headers['content-type']).toContain('text/csv');
    expect(exportResponse.text).toContain('eventType');
  });

  it('reads and updates audit retention policy', async () => {
    const server = app.getHttpServer() as Parameters<typeof request>[0];
    const adminSession = await loginAs('admin@example.com');

    const readResponse = await request(server)
      .get('/admin/audit-logs/retention')
      .set('authorization', `Bearer ${adminSession.tokens.accessToken}`);

    expect(readResponse.status).toBe(200);
    expect(readResponse.body).toMatchObject({
      retentionDays: 180,
      isEnabled: true,
    });

    const updateResponse = await request(server)
      .patch('/admin/audit-logs/retention')
      .set('authorization', `Bearer ${adminSession.tokens.accessToken}`)
      .send({
        retentionDays: 30,
        isEnabled: false,
      });

    expect(updateResponse.status).toBe(200);
    expect(updateResponse.body).toMatchObject({
      retentionDays: 30,
      isEnabled: false,
    });
  });

  it('uploads a docx document and queues virus scanning', async () => {
    const server = app.getHttpServer() as Parameters<typeof request>[0];
    const session = await loginAs('existing@example.com');

    const response = await request(server)
      .post('/documents/upload')
      .set('authorization', `Bearer ${session.tokens.accessToken}`)
      .attach(
        'file',
        Buffer.from('fake-docx-content'),
        {
          filename: 'tez.docx',
          contentType:
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        },
      );

    const body = response.body as DocumentUploadResponse;

    expect(response.status).toBe(201);
    expect(body).toMatchObject({
      title: 'tez',
      originalFileName: 'tez.docx',
      queueStage: 'virus-scan',
    });
    expect(mockDocuments).toHaveLength(1);
    expect(mockDocumentVersions).toHaveLength(2);
    expect(mockDocumentSections.length).toBeGreaterThan(0);
    expect(queuedVirusScans).toHaveLength(1);
    expect(queuedParses).toHaveLength(0);
    expect(Array.from(uploadedObjects.keys())[0]).toContain('/raw/');
  });

  it('returns parse result, outline, confidence, and supports parse retry queueing', async () => {
    const server = app.getHttpServer() as Parameters<typeof request>[0];
    const session = await loginAs('existing@example.com');

    const uploadResponse = await request(server)
      .post('/documents/upload')
      .set('authorization', `Bearer ${session.tokens.accessToken}`)
      .attach('file', Buffer.from('fake-docx-content'), {
        filename: 'tez-parse.docx',
        contentType:
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      });

    const uploadBody = uploadResponse.body as DocumentUploadResponse;

    const parseResultResponse = await request(server)
      .get(`/documents/${uploadBody.documentId}/parse-result`)
      .set('authorization', `Bearer ${session.tokens.accessToken}`);
    const parseResultBody = parseResultResponse.body as ParsedDocumentResult;

    expect(parseResultResponse.status).toBe(200);
    expect(parseResultBody.summary).toMatchObject({
      documentId: uploadBody.documentId,
    });
    expect(parseResultBody.blocks.length).toBeGreaterThan(0);

    const outlineResponse = await request(server)
      .get(`/documents/${uploadBody.documentId}/outline`)
      .set('authorization', `Bearer ${session.tokens.accessToken}`);
    const outlineBody = outlineResponse.body as Array<{ title: string }>;

    expect(outlineResponse.status).toBe(200);
    expect(outlineBody).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          title: 'ABSTRACT',
        }),
      ]),
    );

    const confidenceResponse = await request(server)
      .get(`/documents/${uploadBody.documentId}/confidence`)
      .set('authorization', `Bearer ${session.tokens.accessToken}`);
    const confidenceBody = confidenceResponse.body as ConfidenceResponse;

    expect(confidenceResponse.status).toBe(200);
    expect(confidenceBody.documentId).toBe(uploadBody.documentId);
    expect(typeof confidenceBody.lowConfidence).toBe('boolean');

    const diagnosticsResponse = await request(server)
      .get(`/documents/${uploadBody.documentId}/parse-diagnostics`)
      .set('authorization', `Bearer ${session.tokens.accessToken}`);
    const diagnosticsBody = diagnosticsResponse.body as ParsedDocumentDiagnostics;

    expect(diagnosticsResponse.status).toBe(200);
    expect(diagnosticsBody.documentId).toBe(uploadBody.documentId);
    expect(diagnosticsBody.blockTypeCounts.HEADING).toBeGreaterThan(0);
    expect(diagnosticsBody.templateSlots).toContain('abstract');

    const metricsResponse = await request(server)
      .get(`/documents/${uploadBody.documentId}/parse-metrics`)
      .set('authorization', `Bearer ${session.tokens.accessToken}`);
    const metricsBody = metricsResponse.body as ParsedDocumentMetrics;

    expect(metricsResponse.status).toBe(200);
    expect(metricsBody.documentId).toBe(uploadBody.documentId);
    expect(metricsBody.totalBlocks).toBeGreaterThan(0);
    expect(metricsBody.averageRunsPerBlock).toBeGreaterThanOrEqual(0);
    expect(metricsBody.queue.parsePending).toBeGreaterThanOrEqual(0);

    const retryResponse = await request(server)
      .post(`/documents/${uploadBody.documentId}/parse/retry`)
      .set('authorization', `Bearer ${session.tokens.accessToken}`);

    expect(retryResponse.status).toBe(201);
    expect(retryResponse.body).toEqual({ queued: true });
    expect(queuedParses).toHaveLength(1);

    const pdfConvertResponse = await request(server)
      .post(`/documents/${uploadBody.documentId}/versions/${uploadBody.versionId}/pdf-convert`)
      .set('authorization', `Bearer ${session.tokens.accessToken}`);
    const pdfConvertBody = pdfConvertResponse.body as PdfConvertResponse;

    expect(pdfConvertResponse.status).toBe(201);
    expect(pdfConvertBody).toEqual({ queued: true, lowConfidence: true });
    expect(queuedPdfConversions).toHaveLength(1);
  });

  it('returns citation validation report and highlights bibliography entries', async () => {
    const server = app.getHttpServer() as Parameters<typeof request>[0];
    const session = await loginAs('existing@example.com');

    const uploadResponse = await request(server)
      .post('/documents/upload')
      .set('authorization', `Bearer ${session.tokens.accessToken}`)
      .attach('file', Buffer.from('fake-docx-content'), {
        filename: 'kaynakca.docx',
        contentType:
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      });

    const uploadBody = uploadResponse.body as DocumentUploadResponse;

    mockDocumentVersions.push({
      id: 'document_version_working_citation',
      documentId: uploadBody.documentId,
      type: 'WORKING',
      label: 'Citation working copy',
      storageKey: null,
      contentType: null,
      sizeBytes: null,
      metadata: {
        blocks: [
          {
            orderIndex: 0,
            blockType: 'HEADING',
            semanticSectionType: 'REFERENCES',
            title: 'Kaynakca',
            text: 'Kaynakca',
            level: 1,
            confidenceScore: 0.98,
            numberingPattern: '1',
            lineLengthScore: 1,
            hasCitation: false,
            hasFootnote: false,
            hasEquation: false,
            tableOrFigureLabel: null,
            templateSlot: 'references',
            numberingOverride: null,
            manualSequenceNumber: null,
          },
          {
            orderIndex: 1,
            blockType: 'CITATION',
            semanticSectionType: 'REFERENCES',
            title: null,
            text: 'Smith, J., Doe, A. (2020). "Research methods in practice". Journal of Testing, 12(3), 45-67.',
            level: null,
            confidenceScore: 0.92,
            numberingPattern: null,
            lineLengthScore: 0.72,
            hasCitation: true,
            hasFootnote: false,
            hasEquation: false,
            tableOrFigureLabel: null,
            templateSlot: 'references',
            numberingOverride: null,
            manualSequenceNumber: null,
          },
          {
            orderIndex: 2,
            blockType: 'CITATION',
            semanticSectionType: 'REFERENCES',
            title: null,
            text: 'Brown, C. (2021). Another study. Another Journal, 8(2), 11-20.',
            level: null,
            confidenceScore: 0.9,
            numberingPattern: null,
            lineLengthScore: 0.68,
            hasCitation: true,
            hasFootnote: false,
            hasEquation: false,
            tableOrFigureLabel: null,
            templateSlot: 'references',
            numberingOverride: null,
            manualSequenceNumber: null,
          },
        ],
      },
      createdAt: new Date('2026-04-14T00:20:00.000Z'),
    });

    const validationResponse = await request(server)
      .get(`/documents/${uploadBody.documentId}/citation-validation`)
      .set('authorization', `Bearer ${session.tokens.accessToken}`);
    const validationBody = validationResponse.body as DocumentCitationValidationReport;

    expect(validationResponse.status).toBe(200);
    expect(validationBody.documentId).toBe(uploadBody.documentId);
    expect(validationBody.detectedStyle).toBe('apa-7');
    expect(validationBody.report.status).toBe('REVIEW_REQUIRED');
    expect(validationBody.report.entries.length).toBe(2);
    expect(validationBody.citationBlockOrderIndexes).toEqual([1, 2]);
    expect(validationBody.report.highlightedEntryIndexes).toEqual(expect.arrayContaining([0]));
    expect(validationBody.report.recommendations.length).toBeGreaterThan(0);
  });

  it('supports editor state, autosave snapshot, diff, and restore flows', async () => {
    const server = app.getHttpServer() as Parameters<typeof request>[0];
    const session = await loginAs('existing@example.com');

    const uploadResponse = await request(server)
      .post('/documents/upload')
      .set('authorization', `Bearer ${session.tokens.accessToken}`)
      .attach('file', Buffer.from('fake-docx-content'), {
        filename: 'tez-editor.docx',
        contentType:
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      });

    const uploadBody = uploadResponse.body as DocumentUploadResponse;

    const editorStateResponse = await request(server)
      .get(`/documents/${uploadBody.documentId}/editor-state`)
      .set('authorization', `Bearer ${session.tokens.accessToken}`);
    const editorStateBody = editorStateResponse.body as EditorDocumentVersionState;

    expect(editorStateResponse.status).toBe(200);
    expect(editorStateBody.versionId).toBe(uploadBody.versionId);
    expect(editorStateBody.blocks.length).toBeGreaterThan(0);

    const previewStateResponse = await request(server)
      .get(`/documents/${uploadBody.documentId}/preview-state`)
      .set('authorization', `Bearer ${session.tokens.accessToken}`);
    const previewStateBody = previewStateResponse.body as DocumentPreviewState;

    expect(previewStateResponse.status).toBe(200);
    expect(previewStateBody.documentId).toBe(uploadBody.documentId);
    expect(previewStateBody.blocks.length).toBeGreaterThan(0);

    const workingSaveResponse = await request(server)
      .patch(`/documents/${uploadBody.documentId}/working-version`)
      .set('authorization', `Bearer ${session.tokens.accessToken}`)
      .send({
        label: 'Autosave state',
        settings: {
          pageNumbering: {
            frontMatterStyle: 'roman',
            bodyStyle: 'arabic',
            bodyStartPage: 3,
            bodyStartNumber: 1,
            unnumberedPages: [1, 2],
          },
          sequence: {
            tableStart: 4,
            figureStart: 7,
            equationStart: 2,
          },
        },
        cascadeNotifications: [
          {
            id: 'cascade_1',
            type: 'page-numbering',
            severity: 'info',
            message: 'Page numbering updated.',
          },
        ],
        blocks: editorStateBody.blocks.map((block, index) => ({
          blockType: block.blockType,
          semanticSectionType: block.semanticSectionType,
          title: block.title,
          text: index === 0 ? `${block.text} updated` : block.text,
          level: block.level,
          numberingPattern: block.numberingPattern,
        })),
      });
    const workingSaveBody = workingSaveResponse.body as EditorDocumentVersionState;

    expect(workingSaveResponse.status).toBe(200);
    expect(workingSaveBody.type).toBe('WORKING');
    expect(workingSaveBody.blocks[0]?.text).toContain('updated');
    expect(workingSaveBody.settings.pageNumbering.bodyStartPage).toBe(3);
    expect(workingSaveBody.settings.sequence.tableStart).toBe(4);
    expect(workingSaveBody.cascadeNotifications).toHaveLength(1);

    const refreshedPreviewResponse = await request(server)
      .get(`/documents/${uploadBody.documentId}/preview-state`)
      .set('authorization', `Bearer ${session.tokens.accessToken}`);
    const refreshedPreviewBody = refreshedPreviewResponse.body as DocumentPreviewState;

    expect(refreshedPreviewResponse.status).toBe(200);
    expect(refreshedPreviewBody.sourceVersionId).toBe(workingSaveBody.versionId);
    expect(refreshedPreviewBody.blocks[0]?.text).toContain('updated');

    const snapshotResponse = await request(server)
      .post(`/documents/${uploadBody.documentId}/snapshots`)
      .set('authorization', `Bearer ${session.tokens.accessToken}`)
      .send({
        label: 'Manual snapshot',
      });
    const snapshotBody = snapshotResponse.body as EditorDocumentVersionState;

    expect(snapshotResponse.status).toBe(201);
    expect(snapshotBody.type).toBe('REVISION');

    const diffResponse = await request(server)
      .get(`/documents/${uploadBody.documentId}/versions/${uploadBody.versionId}/diff/${snapshotBody.versionId}`)
      .set('authorization', `Bearer ${session.tokens.accessToken}`);
    const diffBody = diffResponse.body as DocumentVersionDiff;

    expect(diffResponse.status).toBe(200);
    expect(diffBody.changes.length).toBeGreaterThan(0);

    const restoreResponse = await request(server)
      .post(`/documents/${uploadBody.documentId}/versions/${snapshotBody.versionId}/restore`)
      .set('authorization', `Bearer ${session.tokens.accessToken}`);
    const restoreBody = restoreResponse.body as EditorDocumentVersionState;

    expect(restoreResponse.status).toBe(201);
    expect(restoreBody.type).toBe('REVISION');
    expect(restoreBody.blocks[0]?.text).toContain('updated');
  });

  it('rejects non-docx uploads', async () => {
    const server = app.getHttpServer() as Parameters<typeof request>[0];
    const session = await loginAs('existing@example.com');

    const response = await request(server)
      .post('/documents/upload')
      .set('authorization', `Bearer ${session.tokens.accessToken}`)
      .attach('file', Buffer.from('not-docx'), {
        filename: 'tez.pdf',
        contentType: 'application/pdf',
      });

    expect(response.status).toBe(415);
  });

  it('reads and updates document security settings', async () => {
    const server = app.getHttpServer() as Parameters<typeof request>[0];
    const adminSession = await loginAs('admin@example.com');

    const readResponse = await request(server)
      .get('/admin/document-security-settings')
      .set('authorization', `Bearer ${adminSession.tokens.accessToken}`);

    expect(readResponse.status).toBe(200);
    expect(readResponse.body).toMatchObject({
      maxUploadSizeBytes: 10 * 1024 * 1024,
      clamAvEnabled: false,
      virusTotalEnabled: false,
    });

    const updateResponse = await request(server)
      .patch('/admin/document-security-settings')
      .set('authorization', `Bearer ${adminSession.tokens.accessToken}`)
      .send({
        maxUploadSizeBytes: 5 * 1024 * 1024,
        clamAvEnabled: true,
        virusTotalEnabled: true,
      });

    expect(updateResponse.status).toBe(200);
    expect(updateResponse.body).toMatchObject({
      maxUploadSizeBytes: 5 * 1024 * 1024,
      clamAvEnabled: true,
      virusTotalEnabled: true,
    });
  });

  it('reads and updates system settings backup and virus scan policies', async () => {
    const server = app.getHttpServer() as Parameters<typeof request>[0];
    const adminSession = await loginAs('admin@example.com');

    const readResponse = await request(server)
      .get('/admin/system-settings')
      .set('authorization', `Bearer ${adminSession.tokens.accessToken}`);

    expect(readResponse.status).toBe(200);
    expect(readResponse.body).toMatchObject({
      backup: null,
      languages: [
        { code: 'tr', label: 'Turkce' },
        { code: 'en', label: 'English' },
      ],
      documentSecurity: {
        maxUploadSizeBytes: 10 * 1024 * 1024,
        clamAvEnabled: false,
        virusTotalEnabled: false,
      },
    });

    const backupResponse = await request(server)
      .patch('/admin/system-settings/backup')
      .set('authorization', `Bearer ${adminSession.tokens.accessToken}`)
      .send({
        cadence: 'WEEKLY',
        mode: 'INCREMENTAL',
        retentionDays: 45,
      });

    expect(backupResponse.status).toBe(200);
    expect(backupResponse.body).toMatchObject({
      cadence: 'WEEKLY',
      mode: 'INCREMENTAL',
      retentionDays: 45,
    });

    const languagesResponse = await request(server)
      .patch('/admin/system-settings/languages')
      .set('authorization', `Bearer ${adminSession.tokens.accessToken}`)
      .send({
        items: [
          { code: 'tr', label: 'Turkce' },
          { code: 'en', label: 'English' },
          { code: 'de', label: 'Deutsch' },
        ],
      });

    expect(languagesResponse.status).toBe(200);
    expect(languagesResponse.body).toEqual([
      { code: 'tr', label: 'Turkce' },
      { code: 'en', label: 'English' },
      { code: 'de', label: 'Deutsch' },
    ]);

    const documentSecurityResponse = await request(server)
      .patch('/admin/system-settings/document-security')
      .set('authorization', `Bearer ${adminSession.tokens.accessToken}`)
      .send({
        maxUploadSizeBytes: 7 * 1024 * 1024,
        clamAvEnabled: true,
        virusTotalEnabled: true,
      });

    expect(documentSecurityResponse.status).toBe(200);
    expect(documentSecurityResponse.body).toMatchObject({
      maxUploadSizeBytes: 7 * 1024 * 1024,
      clamAvEnabled: true,
      virusTotalEnabled: true,
    });

    const refreshedReadResponse = await request(server)
      .get('/admin/system-settings')
      .set('authorization', `Bearer ${adminSession.tokens.accessToken}`);

    expect(refreshedReadResponse.status).toBe(200);
    expect(refreshedReadResponse.body).toMatchObject({
      backup: {
        cadence: 'WEEKLY',
        mode: 'INCREMENTAL',
        retentionDays: 45,
      },
      languages: [
        { code: 'tr', label: 'Turkce' },
        { code: 'en', label: 'English' },
        { code: 'de', label: 'Deutsch' },
      ],
      documentSecurity: {
        maxUploadSizeBytes: 7 * 1024 * 1024,
        clamAvEnabled: true,
        virusTotalEnabled: true,
      },
    });
  });

  it('supports admin template CRUD, user template editing, export, stats, and promotion', async () => {
    const server = app.getHttpServer() as Parameters<typeof request>[0];
    const adminSession = await loginAs('admin@example.com');
    const userSession = await loginAs('existing@example.com');

    const listResponse = await request(server)
      .get('/templates')
      .set('authorization', `Bearer ${userSession.tokens.accessToken}`);
    const listBody = listResponse.body as Array<{ slug: string; workType: string }>;

    expect(listResponse.status).toBe(200);
    expect(listBody).toHaveLength(1);
    expect(listBody[0]).toMatchObject({
      slug: 'nku-thesis',
      workType: 'thesis',
    });

    const filteredListResponse = await request(server)
      .get('/templates')
      .query({ workType: 'thesis' })
      .set('authorization', `Bearer ${userSession.tokens.accessToken}`);

    expect(filteredListResponse.status).toBe(200);
    expect(filteredListResponse.body).toHaveLength(1);

    const activeWorkTypesResponse = await request(server)
      .get('/template-work-types')
      .set('authorization', `Bearer ${userSession.tokens.accessToken}`);

    expect(activeWorkTypesResponse.status).toBe(200);
    expect(activeWorkTypesResponse.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          slug: 'thesis',
          requiredFixedPages: ['abstract'],
        }),
      ]),
    );

    const createResponse = await request(server)
      .post('/admin/templates')
      .set('authorization', `Bearer ${adminSession.tokens.accessToken}`)
      .send({
        slug: 'ieee-paper',
        name: 'IEEE Paper',
        category: 'Journal',
        workType: 'article',
        description: 'Official article template',
        templateParameters: defaultTemplateParameters,
      });

    expect(createResponse.status).toBe(201);
    expect(createResponse.body).toMatchObject({
      slug: 'ieee-paper',
      version: 1,
    });

    const createdTemplateId = (createResponse.body as { id: string }).id;

    const updateResponse = await request(server)
      .patch(`/admin/templates/${createdTemplateId}`)
      .set('authorization', `Bearer ${adminSession.tokens.accessToken}`)
      .send({
        slug: 'ieee-paper',
        name: 'IEEE Paper Rev 2',
        category: 'Journal',
        workType: 'article',
        description: 'Updated template',
        isActive: true,
        templateParameters: {
          ...defaultTemplateParameters,
          citations: { style: 'IEEE', inline: 'numeric' },
        },
      });

    expect(updateResponse.status).toBe(200);
    expect(updateResponse.body).toMatchObject({
      name: 'IEEE Paper Rev 2',
      version: 2,
    });

    // Immutable update: the update creates a new template row. Clones must
    // target the new live id, not the pre-update (now archived) row.
    const updatedTemplateId = (updateResponse.body as { id: string }).id;
    expect(updatedTemplateId).not.toBe(createdTemplateId);

    const cloneResponse = await request(server)
      .post(`/templates/${updatedTemplateId}/clone`)
      .set('authorization', `Bearer ${userSession.tokens.accessToken}`)
      .send({
        name: 'Benim IEEE formatim',
      });

    expect(cloneResponse.status).toBe(201);
    expect(cloneResponse.body).toMatchObject({
      baseTemplateId: updatedTemplateId,
      name: 'Benim IEEE formatim',
    });

    const myTemplatesResponse = await request(server)
      .get('/templates/me/custom')
      .set('authorization', `Bearer ${userSession.tokens.accessToken}`);
    const myTemplatesBody = myTemplatesResponse.body as Array<{
      id: string;
      name: string;
      baseTemplateId: string | null;
    }>;

    expect(myTemplatesResponse.status).toBe(200);
    expect(myTemplatesBody).toHaveLength(1);
    expect(myTemplatesBody[0]).toMatchObject({
      name: 'Benim IEEE formatim',
      baseTemplateId: updatedTemplateId,
    });

    const firstUserTemplate = myTemplatesBody[0];
    expect(firstUserTemplate).toBeDefined();
    const userTemplateId = firstUserTemplate?.id ?? '';

    const updateUserTemplateResponse = await request(server)
      .patch(`/templates/me/custom/${userTemplateId}`)
      .set('authorization', `Bearer ${userSession.tokens.accessToken}`)
      .send({
        name: 'Benim IEEE formatim v2',
        description: 'Updated custom version',
        templateParameters: {
          ...defaultTemplateParameters,
          pageLayout: {
            paperSize: 'Letter',
          },
        },
      });

    expect(updateUserTemplateResponse.status).toBe(200);
    expect(updateUserTemplateResponse.body).toMatchObject({
      id: userTemplateId,
      name: 'Benim IEEE formatim v2',
    });

    const templateStatsResponse = await request(server)
      .get('/admin/templates/stats')
      .set('authorization', `Bearer ${adminSession.tokens.accessToken}`);

    expect(templateStatsResponse.status).toBe(200);
    expect(templateStatsResponse.body).toMatchObject({
      officialCount: 2,
      userTemplateCount: 1,
      promotedUserTemplateCount: 0,
    });

    const workTypesResponse = await request(server)
      .get('/admin/template-work-types')
      .set('authorization', `Bearer ${adminSession.tokens.accessToken}`);

    expect(workTypesResponse.status).toBe(200);
    expect(workTypesResponse.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          slug: 'article',
        }),
      ]),
    );

    const createWorkTypeResponse = await request(server)
      .post('/admin/template-work-types')
      .set('authorization', `Bearer ${adminSession.tokens.accessToken}`)
      .send({
        slug: 'report',
        label: 'Report',
        isActive: true,
        requiredFixedPages: ['abstract'],
        optionalFixedPages: ['appendix'],
      });

    expect(createWorkTypeResponse.status).toBe(201);
    expect(createWorkTypeResponse.body).toMatchObject({
      slug: 'report',
      optionalFixedPages: ['appendix'],
    });

    const createdWorkTypeId = (createWorkTypeResponse.body as { id: string }).id;

    const updateWorkTypeResponse = await request(server)
      .patch(`/admin/template-work-types/${createdWorkTypeId}`)
      .set('authorization', `Bearer ${adminSession.tokens.accessToken}`)
      .send({
        slug: 'report',
        label: 'Research Report',
        isActive: false,
        requiredFixedPages: ['abstract', 'references'],
        optionalFixedPages: ['appendix', 'cv'],
      });

    expect(updateWorkTypeResponse.status).toBe(200);
    expect(updateWorkTypeResponse.body).toMatchObject({
      label: 'Research Report',
      isActive: false,
      requiredFixedPages: ['abstract', 'references'],
    });

    const exportResponse = await request(server)
      .get('/admin/templates/export')
      .set('authorization', `Bearer ${adminSession.tokens.accessToken}`);

    expect(exportResponse.status).toBe(200);
    const exportBody = exportResponse.body as {
      officialTemplates: unknown[];
      userTemplates: unknown[];
    };

    expect(exportBody.officialTemplates).toEqual(expect.any(Array));
    expect(exportBody.userTemplates).toEqual(expect.any(Array));

    const importResponse = await request(server)
      .post('/admin/templates/import')
      .set('authorization', `Bearer ${adminSession.tokens.accessToken}`)
      .send({
        overwriteExisting: true,
        officialTemplates: [
          {
            slug: 'nku-thesis',
            name: 'NKU Thesis Imported',
            category: 'University',
            workType: 'thesis',
            description: 'Imported overwrite',
            templateParameters: defaultTemplateParameters,
          },
          {
            slug: 'springer-article',
            name: 'Springer Article',
            category: 'Journal',
            workType: 'article',
            description: 'Imported fresh template',
            templateParameters: defaultTemplateParameters,
          },
        ],
      });

    expect(importResponse.status).toBe(201);
    expect(importResponse.body).toMatchObject({
      success: true,
      createdCount: 1,
      updatedCount: 1,
      skippedCount: 0,
    });

    const promoteResponse = await request(server)
      .post(`/admin/templates/promote/${userTemplateId}`)
      .set('authorization', `Bearer ${adminSession.tokens.accessToken}`)
      .send({
        slug: 'promoted-ieee',
        category: 'Journal',
        workType: 'article',
        name: 'Promoted IEEE',
        description: 'Promoted from user template',
      });

    expect(promoteResponse.status).toBe(201);
    expect(promoteResponse.body).toMatchObject({
      slug: 'promoted-ieee',
      name: 'Promoted IEEE',
    });

    const archiveResponse = await request(server)
      .delete(`/templates/me/custom/${userTemplateId}`)
      .set('authorization', `Bearer ${userSession.tokens.accessToken}`);

    expect(archiveResponse.status).toBe(200);
    expect(archiveResponse.body).toEqual({ success: true });

    const deleteWorkTypeResponse = await request(server)
      .delete(`/admin/template-work-types/${createdWorkTypeId}`)
      .set('authorization', `Bearer ${adminSession.tokens.accessToken}`);

    expect(deleteWorkTypeResponse.status).toBe(200);
    expect(deleteWorkTypeResponse.body).toEqual({ success: true });

    const deleteResponse = await request(server)
      .delete(`/admin/templates/${updatedTemplateId}`)
      .set('authorization', `Bearer ${adminSession.tokens.accessToken}`);

    expect(deleteResponse.status).toBe(200);
    expect(deleteResponse.body).toEqual({ success: true });
  });

  it('supports admin analysis category CRUD', async () => {
    const server = app.getHttpServer() as Parameters<typeof request>[0];
    const adminSession = await loginAs('admin@example.com');

    const listResponse = await request(server)
      .get('/admin/analysis-categories')
      .set('authorization', `Bearer ${adminSession.tokens.accessToken}`);

    expect(listResponse.status).toBe(200);
    expect(listResponse.body).toEqual([
      expect.objectContaining({
        slug: 'statistical-analysis',
        sortOrder: 10,
      }),
      expect.objectContaining({
        slug: 'qualitative-coding',
        sortOrder: 20,
      }),
    ]);

    const createResponse = await request(server)
      .post('/admin/analysis-categories')
      .set('authorization', `Bearer ${adminSession.tokens.accessToken}`)
      .send({
        slug: 'literature-review',
        name: 'Literature Review',
        description: 'Structured review and synthesis support.',
        isActive: true,
        sortOrder: 5,
      });

    expect(createResponse.status).toBe(201);
    expect(createResponse.body).toMatchObject({
      slug: 'literature-review',
      name: 'Literature Review',
      sortOrder: 5,
    });

    const createdCategoryId = (createResponse.body as { id: string }).id;

    const updateResponse = await request(server)
      .patch(`/admin/analysis-categories/${createdCategoryId}`)
      .set('authorization', `Bearer ${adminSession.tokens.accessToken}`)
      .send({
        slug: 'literature-review',
        name: 'Literature Review Plus',
        description: 'Expanded review and gap analysis support.',
        isActive: false,
        sortOrder: 7,
      });

    expect(updateResponse.status).toBe(200);
    expect(updateResponse.body).toMatchObject({
      id: createdCategoryId,
      name: 'Literature Review Plus',
      isActive: false,
      sortOrder: 7,
    });

    const deleteResponse = await request(server)
      .delete(`/admin/analysis-categories/${createdCategoryId}`)
      .set('authorization', `Bearer ${adminSession.tokens.accessToken}`);

    expect(deleteResponse.status).toBe(200);
    expect(deleteResponse.body).toEqual({ success: true });
  });

  it('supports admin analysis add-on CRUD', async () => {
    const server = app.getHttpServer() as Parameters<typeof request>[0];
    const adminSession = await loginAs('admin@example.com');

    const listResponse = await request(server)
      .get('/admin/analysis-add-ons')
      .set('authorization', `Bearer ${adminSession.tokens.accessToken}`);

    expect(listResponse.status).toBe(200);
    expect(listResponse.body).toEqual([
      expect.objectContaining({
        slug: 'extra-revision',
        priceCents: 50000,
      }),
      expect.objectContaining({
        slug: 'rush-delivery',
        priceCents: 150000,
      }),
    ]);

    const createResponse = await request(server)
      .post('/admin/analysis-add-ons')
      .set('authorization', `Bearer ${adminSession.tokens.accessToken}`)
      .send({
        slug: 'methodology-review',
        name: 'Methodology Review',
        description: 'Focused feedback on research design.',
        priceCents: 80000,
        isActive: true,
      });

    expect(createResponse.status).toBe(201);
    expect(createResponse.body).toMatchObject({
      slug: 'methodology-review',
      name: 'Methodology Review',
      priceCents: 80000,
    });

    const createdAddOnId = (createResponse.body as { id: string }).id;

    const updateResponse = await request(server)
      .patch(`/admin/analysis-add-ons/${createdAddOnId}`)
      .set('authorization', `Bearer ${adminSession.tokens.accessToken}`)
      .send({
        slug: 'methodology-review',
        name: 'Methodology Review Plus',
        description: 'Expanded design review and risk notes.',
        priceCents: 95000,
        isActive: false,
      });

    expect(updateResponse.status).toBe(200);
    expect(updateResponse.body).toMatchObject({
      id: createdAddOnId,
      name: 'Methodology Review Plus',
      priceCents: 95000,
      isActive: false,
    });

    const deleteResponse = await request(server)
      .delete(`/admin/analysis-add-ons/${createdAddOnId}`)
      .set('authorization', `Bearer ${adminSession.tokens.accessToken}`);

    expect(deleteResponse.status).toBe(200);
    expect(deleteResponse.body).toEqual({ success: true });
  });

  it('creates an analysis ticket for an active category', async () => {
    const server = app.getHttpServer() as Parameters<typeof request>[0];
    const session = await loginAs('existing@example.com');

    const createResponse = await request(server)
      .post('/analysis/tickets')
      .set('authorization', `Bearer ${session.tokens.accessToken}`)
      .send({
        categorySlug: 'statistical-analysis',
        title: 'SPSS veri analizi talebi',
        brief: 'Likert verilerim icin regresyon ve korelasyon analizi istiyorum.',
        deliveryMode: 'STANDARD',
      });

    expect(createResponse.status).toBe(201);
    expect(createResponse.body).toMatchObject({
      customerUserId: 'existing_user',
      assignedExpertUserId: 'expert_user_2',
      categorySlug: 'statistical-analysis',
      categoryNameSnapshot: 'Statistical Analysis',
      title: 'SPSS veri analizi talebi',
      status: 'ASSIGNED',
      deliveryMode: 'STANDARD',
    });
    expect((createResponse.body as { ticketNumber: string }).ticketNumber).toMatch(/^ANL-\d{8}-[A-Z0-9]{8}$/);
    expect(mockAnalysisTickets).toHaveLength(1);
    expect(mockExpertProfiles.find((entry) => entry.id === 'expert_profile_2')?.activeTickets).toBe(2);
  });

  it('supports separate analysis ticket upload areas for data, description, and sample files', async () => {
    const server = app.getHttpServer() as Parameters<typeof request>[0];
    const session = await loginAs('existing@example.com');

    const ticketResponse = await request(server)
      .post('/analysis/tickets')
      .set('authorization', `Bearer ${session.tokens.accessToken}`)
      .send({
        categorySlug: 'statistical-analysis',
        title: 'Analiz dosya alanlari',
        brief: 'Ham veri, aciklama ve ornek cikti dosyalarini ayri alanlardan yukleyecegim.',
      });

    expect(ticketResponse.status).toBe(201);
    const ticketId = (ticketResponse.body as { id: string }).id;

    const dataUploadResponse = await request(server)
      .post(`/analysis/tickets/${ticketId}/files/data`)
      .set('authorization', `Bearer ${session.tokens.accessToken}`)
      .attach('dataFile', Buffer.from('col1,col2\n1,2'), {
        filename: 'dataset.csv',
        contentType: 'text/csv',
      });

    expect(dataUploadResponse.status).toBe(201);
    expect(dataUploadResponse.body).toMatchObject({
      ticketId,
      fileType: 'DATA',
      originalFileName: 'dataset.csv',
    });

    const descriptionUploadResponse = await request(server)
      .post(`/analysis/tickets/${ticketId}/files/description`)
      .set('authorization', `Bearer ${session.tokens.accessToken}`)
      .attach('descriptionFile', Buffer.from('Hypothesis and variables'), {
        filename: 'brief.txt',
        contentType: 'text/plain',
      });

    expect(descriptionUploadResponse.status).toBe(201);
    expect(descriptionUploadResponse.body).toMatchObject({
      ticketId,
      fileType: 'DESCRIPTION',
      originalFileName: 'brief.txt',
    });

    const sampleUploadResponse = await request(server)
      .post(`/analysis/tickets/${ticketId}/files/sample`)
      .set('authorization', `Bearer ${session.tokens.accessToken}`)
      .attach('sampleFile', Buffer.from('%PDF-1.4 sample'), {
        filename: 'sample.pdf',
        contentType: 'application/pdf',
      });

    expect(sampleUploadResponse.status).toBe(201);
    expect(sampleUploadResponse.body).toMatchObject({
      ticketId,
      fileType: 'SAMPLE',
      originalFileName: 'sample.pdf',
    });

    expect(mockTicketFiles).toHaveLength(3);
    expect(Array.from(uploadedObjects.keys())).toEqual(
      expect.arrayContaining([
        expect.stringContaining(`/data/`),
        expect.stringContaining(`/description/`),
        expect.stringContaining(`/sample/`),
      ]),
    );
  });

  it('supports optional NDA flow for assigned analysis experts', async () => {
    const server = app.getHttpServer() as Parameters<typeof request>[0];
    const userSession = await loginAs('existing@example.com');
    const adminSession = await loginAs('admin@example.com');
    const expertSession = await loginAs('expert2@example.com');

    const ticketResponse = await request(server)
      .post('/analysis/tickets')
      .set('authorization', `Bearer ${userSession.tokens.accessToken}`)
      .send({
        categorySlug: 'statistical-analysis',
        title: 'NDA gerekli analiz',
        brief: 'Bu ticket icin gizlilik sozlesmesi uzman kabulunden sonra aktif olmali.',
      });

    expect(ticketResponse.status).toBe(201);
    const ticketId = (ticketResponse.body as { id: string }).id;

    const createNdaResponse = await request(server)
      .post(`/admin/analysis/tickets/${ticketId}/nda`)
      .set('authorization', `Bearer ${adminSession.tokens.accessToken}`)
      .send({
        expertUserId: 'expert_user_2',
        documentStorageKey: 'legal/nda-standard-v1.pdf',
      });

    expect(createNdaResponse.status).toBe(201);
    expect(createNdaResponse.body).toMatchObject({
      ticketId,
      expertUserId: 'expert_user_2',
      documentStorageKey: 'legal/nda-standard-v1.pdf',
      agreedAt: null,
    });

    const agreeResponse = await request(server)
      .post(`/analysis/tickets/${ticketId}/nda/agree`)
      .set('authorization', `Bearer ${expertSession.tokens.accessToken}`);

    expect(agreeResponse.status).toBe(201);
    expect(agreeResponse.body).toMatchObject({
      ticketId,
      expertUserId: 'expert_user_2',
      documentStorageKey: 'legal/nda-standard-v1.pdf',
    });
    expect((agreeResponse.body as { agreedAt: string | null }).agreedAt).not.toBeNull();
    expect(mockNdaAgreements).toHaveLength(1);
  });

  it('executes the full analysis ticket lifecycle: create → list → quote → approve → message → deliver → result → rate → close', async () => {
    const server = app.getHttpServer() as Parameters<typeof request>[0];
    const customerSession = await loginAs('existing@example.com');
    const expertSession = await loginAs('expert2@example.com');
    const adminSession = await loginAs('admin@example.com');

    // Step 1: Customer creates ticket
    const createResponse = await request(server)
      .post('/analysis/tickets')
      .set('authorization', `Bearer ${customerSession.tokens.accessToken}`)
      .send({
        categorySlug: 'statistical-analysis',
        title: 'Full lifecycle analiz',
        brief: 'Bu test tum analiz surecini kapsamaktadir.',
        deliveryMode: 'STANDARD',
      });

    expect(createResponse.status).toBe(201);
    const ticketId = (createResponse.body as { id: string }).id;
    expect((createResponse.body as { status: string }).status).toBe('ASSIGNED');

    // Step 2: Customer lists their tickets
    const listResponse = await request(server)
      .get('/analysis/tickets')
      .set('authorization', `Bearer ${customerSession.tokens.accessToken}`);

    expect(listResponse.status).toBe(200);
    expect((listResponse.body as { items: unknown[]; total: number }).items).toHaveLength(1);
    expect((listResponse.body as { total: number }).total).toBe(1);

    // Step 3: Customer fetches ticket detail
    const detailResponse = await request(server)
      .get(`/analysis/tickets/${ticketId}`)
      .set('authorization', `Bearer ${customerSession.tokens.accessToken}`);

    expect(detailResponse.status).toBe(200);
    expect((detailResponse.body as { id: string }).id).toBe(ticketId);
    expect((detailResponse.body as { quotePriceCents: number | null }).quotePriceCents).toBeNull();

    // Step 4: Expert views their assigned tickets
    const expertListResponse = await request(server)
      .get('/expert/tickets')
      .set('authorization', `Bearer ${expertSession.tokens.accessToken}`);

    expect(expertListResponse.status).toBe(200);
    expect((expertListResponse.body as { items: unknown[] }).items).toHaveLength(1);

    // Step 5: Expert submits a quote
    const quoteResponse = await request(server)
      .post(`/expert/tickets/${ticketId}/quote`)
      .set('authorization', `Bearer ${expertSession.tokens.accessToken}`)
      .send({ priceCents: 25000, note: 'Iki gun icinde teslim edilecek.', deadlineAt: '2026-04-20T00:00:00.000Z' });

    expect(quoteResponse.status).toBe(201);
    expect((quoteResponse.body as { status: string }).status).toBe('QUOTED');
    expect((quoteResponse.body as { quotePriceCents: number }).quotePriceCents).toBe(25000);
    expect((quoteResponse.body as { quotedAt: string | null }).quotedAt).not.toBeNull();

    // Step 6: Customer sends a message before approving
    const msgResponse = await request(server)
      .post(`/analysis/tickets/${ticketId}/messages`)
      .set('authorization', `Bearer ${customerSession.tokens.accessToken}`)
      .send({ body: 'Fiyat uygun. Onayliyorum.' });

    expect(msgResponse.status).toBe(201);
    expect((msgResponse.body as { senderType: string }).senderType).toBe('CUSTOMER');
    expect((msgResponse.body as { body: string }).body).toBe('Fiyat uygun. Onayliyorum.');

    // Step 7: Expert replies
    const expertMsgResponse = await request(server)
      .post(`/expert/tickets/${ticketId}/messages`)
      .set('authorization', `Bearer ${expertSession.tokens.accessToken}`)
      .send({ body: 'Tesekkurler, analize basliyor.' });

    expect(expertMsgResponse.status).toBe(201);
    expect((expertMsgResponse.body as { senderType: string }).senderType).toBe('EXPERT');

    // Step 8: List all messages
    const messagesResponse = await request(server)
      .get(`/analysis/tickets/${ticketId}/messages`)
      .set('authorization', `Bearer ${customerSession.tokens.accessToken}`);

    expect(messagesResponse.status).toBe(200);
    expect(messagesResponse.body).toHaveLength(2);

    // Step 9: Customer approves quote
    const approveResponse = await request(server)
      .post(`/analysis/tickets/${ticketId}/approve`)
      .set('authorization', `Bearer ${customerSession.tokens.accessToken}`);

    expect(approveResponse.status).toBe(201);
    expect((approveResponse.body as { status: string }).status).toBe('IN_PROGRESS');
    expect((approveResponse.body as { customerApprovedAt: string | null }).customerApprovedAt).not.toBeNull();

    // Step 10: Expert uploads result file
    const resultUploadResponse = await request(server)
      .post(`/expert/tickets/${ticketId}/files/result`)
      .set('authorization', `Bearer ${expertSession.tokens.accessToken}`)
      .attach('resultFile', Buffer.from('%PDF-1.4 result'), {
        filename: 'analiz-sonucu.pdf',
        contentType: 'application/pdf',
      });

    expect(resultUploadResponse.status).toBe(201);
    expect((resultUploadResponse.body as { fileType: string }).fileType).toBe('RESULT');
    expect((resultUploadResponse.body as { originalFileName: string }).originalFileName).toBe('analiz-sonucu.pdf');

    // Step 11: Expert marks ticket as delivered
    const deliverResponse = await request(server)
      .post(`/expert/tickets/${ticketId}/deliver`)
      .set('authorization', `Bearer ${expertSession.tokens.accessToken}`);

    expect(deliverResponse.status).toBe(201);
    expect((deliverResponse.body as { status: string }).status).toBe('DELIVERED');

    // Verify a system message was created for delivery
    expect(mockTicketMessages.some((m) => m.senderType === 'SYSTEM' && m.ticketId === ticketId)).toBe(true);

    // Step 12: Customer views files (should include result)
    const filesResponse = await request(server)
      .get(`/analysis/tickets/${ticketId}/files`)
      .set('authorization', `Bearer ${customerSession.tokens.accessToken}`);

    expect(filesResponse.status).toBe(200);
    expect((filesResponse.body as Array<{ fileType: string }>).some((f) => f.fileType === 'RESULT')).toBe(true);

    // Step 13: Customer rates the ticket
    const rateResponse = await request(server)
      .post(`/analysis/tickets/${ticketId}/rate`)
      .set('authorization', `Bearer ${customerSession.tokens.accessToken}`)
      .send({ rating: 5, comment: 'Mukemmel calisma, cok tesekkurler!' });

    expect(rateResponse.status).toBe(201);
    expect((rateResponse.body as { rating: number }).rating).toBe(5);
    expect((rateResponse.body as { ratedAt: string | null }).ratedAt).not.toBeNull();

    // Step 14: Customer closes the ticket
    const closeResponse = await request(server)
      .post(`/analysis/tickets/${ticketId}/close`)
      .set('authorization', `Bearer ${customerSession.tokens.accessToken}`);

    expect(closeResponse.status).toBe(201);
    expect((closeResponse.body as { status: string }).status).toBe('CLOSED');
    expect((closeResponse.body as { closedAt: string | null }).closedAt).not.toBeNull();

    // Step 15: Admin can list all tickets
    const adminListResponse = await request(server)
      .get('/admin/analysis/tickets')
      .set('authorization', `Bearer ${adminSession.tokens.accessToken}`);

    expect(adminListResponse.status).toBe(200);
    expect((adminListResponse.body as { items: unknown[] }).items).toHaveLength(1);

    // Step 16: Admin can view ticket detail
    const adminDetailResponse = await request(server)
      .get(`/admin/analysis/tickets/${ticketId}`)
      .set('authorization', `Bearer ${adminSession.tokens.accessToken}`);

    expect(adminDetailResponse.status).toBe(200);
    expect((adminDetailResponse.body as { status: string }).status).toBe('CLOSED');
  });

  it('handles quote rejection and admin force-status override', async () => {
    const server = app.getHttpServer() as Parameters<typeof request>[0];
    const customerSession = await loginAs('existing@example.com');
    const expertSession = await loginAs('expert2@example.com');
    const adminSession = await loginAs('admin@example.com');

    // Create ticket
    const createResponse = await request(server)
      .post('/analysis/tickets')
      .set('authorization', `Bearer ${customerSession.tokens.accessToken}`)
      .send({
        categorySlug: 'statistical-analysis',
        title: 'Reddet ve force status testi',
        brief: 'Teklif reddedilecek ve admin durumu degistirecek.',
      });

    expect(createResponse.status).toBe(201);
    const ticketId = (createResponse.body as { id: string }).id;

    // Expert submits quote
    const quoteResponse = await request(server)
      .post(`/expert/tickets/${ticketId}/quote`)
      .set('authorization', `Bearer ${expertSession.tokens.accessToken}`)
      .send({ priceCents: 50000, note: 'Cok detayli analiz gerekiyor.' });

    expect(quoteResponse.status).toBe(201);
    expect((quoteResponse.body as { status: string }).status).toBe('QUOTED');

    // Customer rejects quote → should go back to ASSIGNED
    const rejectResponse = await request(server)
      .post(`/analysis/tickets/${ticketId}/reject`)
      .set('authorization', `Bearer ${customerSession.tokens.accessToken}`);

    expect(rejectResponse.status).toBe(201);
    expect((rejectResponse.body as { status: string }).status).toBe('ASSIGNED');
    expect((rejectResponse.body as { quotePriceCents: number | null }).quotePriceCents).toBeNull();

    // Admin force-sets status to CANCELLED
    const forceStatusResponse = await request(server)
      .patch(`/admin/analysis/tickets/${ticketId}/status`)
      .set('authorization', `Bearer ${adminSession.tokens.accessToken}`)
      .send({ status: 'CANCELLED' });

    expect(forceStatusResponse.status).toBe(200);
    expect((forceStatusResponse.body as { status: string }).status).toBe('CANCELLED');
    expect((forceStatusResponse.body as { closedAt: string | null }).closedAt).not.toBeNull();

    // Verify a system message was created for admin status change
    const adminMessages = mockTicketMessages.filter(
      (m) => m.ticketId === ticketId && m.senderType === 'SYSTEM',
    );

    expect(adminMessages.length).toBeGreaterThan(0);
  });

  it('handles express upgrade and revision request', async () => {
    const server = app.getHttpServer() as Parameters<typeof request>[0];
    const customerSession = await loginAs('existing@example.com');
    const expertSession = await loginAs('expert2@example.com');

    // Create ticket
    const createResponse = await request(server)
      .post('/analysis/tickets')
      .set('authorization', `Bearer ${customerSession.tokens.accessToken}`)
      .send({
        categorySlug: 'statistical-analysis',
        title: 'Express ve revizyon testi',
        brief: 'Once express gececegiz sonra revizyon isteyecegiz.',
        deliveryMode: 'STANDARD',
      });

    expect(createResponse.status).toBe(201);
    const ticketId = (createResponse.body as { id: string }).id;

    // Customer upgrades to express
    const expressResponse = await request(server)
      .post(`/analysis/tickets/${ticketId}/express`)
      .set('authorization', `Bearer ${customerSession.tokens.accessToken}`);

    expect(expressResponse.status).toBe(201);
    expect((expressResponse.body as { deliveryMode: string }).deliveryMode).toBe('EXPRESS');

    // Drive ticket to DELIVERED state via quote + approve + deliver
    await request(server)
      .post(`/expert/tickets/${ticketId}/quote`)
      .set('authorization', `Bearer ${expertSession.tokens.accessToken}`)
      .send({ priceCents: 15000 });

    await request(server)
      .post(`/analysis/tickets/${ticketId}/approve`)
      .set('authorization', `Bearer ${customerSession.tokens.accessToken}`);

    const deliverResponse = await request(server)
      .post(`/expert/tickets/${ticketId}/deliver`)
      .set('authorization', `Bearer ${expertSession.tokens.accessToken}`);

    expect(deliverResponse.status).toBe(201);
    expect((deliverResponse.body as { status: string }).status).toBe('DELIVERED');

    // Customer requests revision
    const revisionResponse = await request(server)
      .post(`/analysis/tickets/${ticketId}/revision`)
      .set('authorization', `Bearer ${customerSession.tokens.accessToken}`)
      .send({ reason: 'Tablo 3 hatali gorunuyor, lutfen kontrol edin.' });

    expect(revisionResponse.status).toBe(201);
    expect((revisionResponse.body as { status: string }).status).toBe('REVISION_REQUESTED');
    expect((revisionResponse.body as { revisionCount: number }).revisionCount).toBe(1);

    // Revision request should also create a message
    const revisionMessages = mockTicketMessages.filter(
      (m) => m.ticketId === ticketId && m.senderType === 'CUSTOMER',
    );

    expect(revisionMessages.length).toBeGreaterThan(0);
    expect(revisionMessages[0].body).toBe('Tablo 3 hatali gorunuyor, lutfen kontrol edin.');

    // Expert re-delivers after revision
    const redeliverResponse = await request(server)
      .post(`/expert/tickets/${ticketId}/deliver`)
      .set('authorization', `Bearer ${expertSession.tokens.accessToken}`);

    expect(redeliverResponse.status).toBe(201);
    expect((redeliverResponse.body as { status: string }).status).toBe('DELIVERED');

    // Customer closes (no rate this time)
    const closeResponse = await request(server)
      .post(`/analysis/tickets/${ticketId}/close`)
      .set('authorization', `Bearer ${customerSession.tokens.accessToken}`);

    expect(closeResponse.status).toBe(201);
    expect((closeResponse.body as { status: string }).status).toBe('CLOSED');
  });

  it('enforces analysis ticket access control', async () => {
    const server = app.getHttpServer() as Parameters<typeof request>[0];
    const customerSession = await loginAs('existing@example.com');
    const expertSession = await loginAs('expert2@example.com');

    // Create a ticket
    const createResponse = await request(server)
      .post('/analysis/tickets')
      .set('authorization', `Bearer ${customerSession.tokens.accessToken}`)
      .send({
        categorySlug: 'statistical-analysis',
        title: 'Erisim kontrol testi',
        brief: 'Bu ticket baskasi tarafindan gorulememeli.',
      });

    expect(createResponse.status).toBe(201);
    const ticketId = (createResponse.body as { id: string }).id;

    // Experts cannot access customer ticket detail via customer endpoint
    const wrongAccessResponse = await request(server)
      .get(`/analysis/tickets/${ticketId}`)
      .set('authorization', `Bearer ${expertSession.tokens.accessToken}`);

    // Expert's session userId is 'expert_user_2' but ticket.customerUserId is 'existing_user'
    expect(wrongAccessResponse.status).toBe(404);

    // Customer cannot cancel a ticket that is in progress
    // First drive to IN_PROGRESS
    await request(server)
      .post(`/expert/tickets/${ticketId}/quote`)
      .set('authorization', `Bearer ${expertSession.tokens.accessToken}`)
      .send({ priceCents: 10000 });

    await request(server)
      .post(`/analysis/tickets/${ticketId}/approve`)
      .set('authorization', `Bearer ${customerSession.tokens.accessToken}`);

    const cancelResponse = await request(server)
      .delete(`/analysis/tickets/${ticketId}`)
      .set('authorization', `Bearer ${customerSession.tokens.accessToken}`);

    expect(cancelResponse.status).toBe(400);
  });

  it('lists document details, versions, presigned download, and soft delete', async () => {
    const server = app.getHttpServer() as Parameters<typeof request>[0];
    const session = await loginAs('existing@example.com');

    const uploadResponse = await request(server)
      .post('/documents/upload')
      .set('authorization', `Bearer ${session.tokens.accessToken}`)
      .attach('file', Buffer.from('fake-docx-content'), {
        filename: 'makale.docx',
        contentType:
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      });

    const uploadBody = uploadResponse.body as DocumentUploadResponse;
    const documentId = uploadBody.documentId;
    const rawVersionId = uploadBody.versionId;
    mockDocumentVersions.push({
      id: 'final_version_1',
      documentId,
      type: 'FINAL',
      label: 'Paid final',
      storageKey: 'documents/existing_user/document_1/final/final_version_1.docx',
      contentType:
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      sizeBytes: 2048,
      metadata: null,
      createdAt: new Date('2026-04-14T00:10:00.000Z'),
    });

    const listResponse = await request(server)
      .get('/documents')
      .set('authorization', `Bearer ${session.tokens.accessToken}`);

    expect(listResponse.status).toBe(200);
    expect(listResponse.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: documentId,
          title: 'makale',
        }),
      ]),
    );

    const detailResponse = await request(server)
      .get(`/documents/${documentId}`)
      .set('authorization', `Bearer ${session.tokens.accessToken}`);

    const detailBody = detailResponse.body as DocumentDetailResponse;

    expect(detailResponse.status).toBe(200);
    expect(detailBody.versions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: rawVersionId, type: 'RAW' }),
        expect.objectContaining({ id: 'final_version_1', type: 'FINAL' }),
      ]),
    );

    const historyResponse = await request(server)
      .get(`/documents/${documentId}/versions`)
      .set('authorization', `Bearer ${session.tokens.accessToken}`);

    const historyBody = historyResponse.body as Array<{ id: string }>;

    expect(historyResponse.status).toBe(200);
    expect(historyBody.length).toBeGreaterThanOrEqual(2);

    const presignResponse = await request(server)
      .get(`/documents/${documentId}/versions/${rawVersionId}/presigned-download`)
      .set('authorization', `Bearer ${session.tokens.accessToken}`);

    const presignBody = presignResponse.body as PresignedUrlResponse;

    expect(presignResponse.status).toBe(200);
    expect(presignBody.url).toContain('/download/');

    const finalDownloadResponse = await request(server)
      .get(`/documents/${documentId}/download/final`)
      .set('authorization', `Bearer ${session.tokens.accessToken}`);

    const finalDownloadBody = finalDownloadResponse.body as PresignedUrlResponse;

    expect(finalDownloadResponse.status).toBe(200);
    expect(finalDownloadBody.url).toContain('/download/');

    const deleteResponse = await request(server)
      .delete(`/documents/${documentId}`)
      .set('authorization', `Bearer ${session.tokens.accessToken}`);

    expect(deleteResponse.status).toBe(200);
    expect(deleteResponse.body).toEqual({ success: true });
  });

  it('supports multi-file uploads and resumable upload sessions', async () => {
    const server = app.getHttpServer() as Parameters<typeof request>[0];
    const session = await loginAs('existing@example.com');

    const batchResponse = await request(server)
      .post('/documents/upload/batch')
      .set('authorization', `Bearer ${session.tokens.accessToken}`)
      .attach('files', Buffer.from('docx-1'), {
        filename: 'bir.docx',
        contentType:
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      })
      .attach('files', Buffer.from('docx-2'), {
        filename: 'iki.docx',
        contentType:
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      });

    expect(batchResponse.status).toBe(201);
    expect(batchResponse.body).toHaveLength(2);

    const sessionCreateResponse = await request(server)
      .post('/documents/upload-sessions')
      .set('authorization', `Bearer ${session.tokens.accessToken}`)
      .send({
        fileName: 'uzun-dosya.docx',
        mimeType:
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        sizeBytes: 4096,
      });

    expect(sessionCreateResponse.status).toBe(201);
    const sessionCreateBody = sessionCreateResponse.body as UploadSessionResponse;
    expect(sessionCreateBody).toMatchObject({
      status: 'CREATED',
      progress: 5,
    });

    const sessionId = sessionCreateBody.sessionId;
    const sessionReadResponse = await request(server)
      .get(`/documents/upload-sessions/${sessionId}`)
      .set('authorization', `Bearer ${session.tokens.accessToken}`);

    const sessionReadBody = sessionReadResponse.body as UploadSessionResponse;
    expect(sessionReadResponse.status).toBe(200);
    expect(sessionReadBody.status).toBe('CREATED');

    const completeResponse = await request(server)
      .post('/documents/upload-sessions/complete')
      .set('authorization', `Bearer ${session.tokens.accessToken}`)
      .send({ sessionId });

    const completeBody = completeResponse.body as DocumentUploadResponse;
    expect(completeResponse.status).toBe(201);
    expect(completeBody.originalFileName).toBe('uzun-dosya.docx');
    expect(queuedParses).toHaveLength(1);
  });

  it('rejects duplicate registrations', async () => {
    const server = app.getHttpServer() as Parameters<typeof request>[0];
    const response = await request(server).post('/auth/register').send({
      email: 'existing@example.com',
      password: 'supersecret',
      academicTitle: 'UNDERGRADUATE',
    });

    expect(response.status).toBe(409);
  });

  it('returns standardized error responses', async () => {
    const server = app.getHttpServer() as Parameters<typeof request>[0];
    const response = await request(server).get('/debug/error').set('x-request-id', 'req-error-test');

    const body = response.body as ErrorResponse;

    expect(response.status).toBe(500);
    expect(body.requestId).toBe('req-error-test');
  });

  /**
   * Golden path: upload → parse → editor state → autosave → snapshot →
   * list versions → presigned download → soft delete.
   */
  it('executes the full document golden path', async () => {
    const server = app.getHttpServer() as Parameters<typeof request>[0];
    const session = await loginAs('existing@example.com');

    // 1. Upload
    const uploadResponse = await request(server)
      .post('/documents/upload')
      .set('authorization', `Bearer ${session.tokens.accessToken}`)
      .attach('file', Buffer.from('golden-path-docx'), {
        filename: 'golden-path.docx',
        contentType:
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      });
    expect(uploadResponse.status).toBe(201);
    const upload = uploadResponse.body as DocumentUploadResponse;

    // 2. Parse result (outline + sections)
    const parseResponse = await request(server)
      .get(`/documents/${upload.documentId}/parse-result`)
      .set('authorization', `Bearer ${session.tokens.accessToken}`);
    expect(parseResponse.status).toBe(200);
    const parseBody = parseResponse.body as { blocks: Array<{ blockType: string }> };
    expect(parseBody.blocks.length).toBeGreaterThan(0);

    // 3. Editor state
    const editorResponse = await request(server)
      .get(`/documents/${upload.documentId}/editor-state`)
      .set('authorization', `Bearer ${session.tokens.accessToken}`);
    expect(editorResponse.status).toBe(200);
    const editorState = editorResponse.body as EditorDocumentVersionState;
    expect(editorState.blocks.length).toBeGreaterThan(0);

    // 4. Autosave working version
    const autosaveResponse = await request(server)
      .patch(`/documents/${upload.documentId}/working-version`)
      .set('authorization', `Bearer ${session.tokens.accessToken}`)
      .send({
        label: 'Golden path autosave',
        settings: editorState.settings,
        cascadeNotifications: [],
        blocks: editorState.blocks.map((b) => ({
          blockType: b.blockType,
          semanticSectionType: b.semanticSectionType,
          title: b.title,
          text: b.text,
          level: b.level,
          numberingPattern: b.numberingPattern,
        })),
      });
    expect(autosaveResponse.status).toBe(200);

    // 5. Create snapshot
    const snapshotResponse = await request(server)
      .post(`/documents/${upload.documentId}/snapshots`)
      .set('authorization', `Bearer ${session.tokens.accessToken}`)
      .send({ label: 'Golden path snapshot' });
    expect(snapshotResponse.status).toBe(201);

    // 6. List versions
    const versionsResponse = await request(server)
      .get(`/documents/${upload.documentId}/versions`)
      .set('authorization', `Bearer ${session.tokens.accessToken}`);
    expect(versionsResponse.status).toBe(200);
    const versions = versionsResponse.body as Array<{ id: string; type: string }>;
    expect(versions.length).toBeGreaterThanOrEqual(3);

    // 7. Presigned download
    const downloadResponse = await request(server)
      .get(`/documents/${upload.documentId}/versions/${upload.versionId}/presigned-download`)
      .set('authorization', `Bearer ${session.tokens.accessToken}`);
    expect(downloadResponse.status).toBe(200);

    // 8. Soft delete
    const deleteResponse = await request(server)
      .delete(`/documents/${upload.documentId}`)
      .set('authorization', `Bearer ${session.tokens.accessToken}`);
    expect(deleteResponse.status).toBe(200);
    expect(deleteResponse.body).toEqual({ success: true });
  });
});
