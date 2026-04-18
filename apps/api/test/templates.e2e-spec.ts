import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { TemplatesService } from '../src/modules/templates/templates.service';
import { PrismaService } from '../src/prisma.service';
import { AuditEventEmitterService } from '../src/modules/audit/audit-event-emitter.service';

const defaultTemplateParameters = {
  pageLayout: {
    paperSize: 'A4',
    marginTopCm: 4,
    marginBottomCm: 3,
    marginLeftCm: 3,
    marginRightCm: 3,
  },
  typography: {
    fontFamily: 'Times New Roman',
    fontSizePt: 12,
    lineSpacing: 1.5,
  },
  headingHierarchy: { levels: 5, maxLevel: 5 },
  pageNumbering: { startAt: 1, position: 'bottom-center' },
  coverPages: { enabled: true },
  fixedPages: { acknowledgements: true, abstract: true },
  sectionOrdering: {
    items: ['cover', 'abstract', 'introduction', 'references'],
  },
  tableFigureFormatting: { tableLabel: 'Tablo', figureLabel: 'Sekil' },
  equationFormatting: { numbering: 'right' },
  citations: { style: 'APA7', inline: 'author-date' },
  restrictions: { maxHeadingLevel: 5 },
};

interface MockCreateArgs<TData> {
  data: TData;
}

interface MockUpdateArgs<TData> {
  where: { id: string };
  data: TData;
}

interface MockTemplateRecord {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  category: string;
  workType: string;
  isActive: boolean;
  version: number;
  usageCount: number;
  templateParameters: typeof defaultTemplateParameters;
  createdByUserId: string | null;
  sourceUserTemplateId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

interface MockUserTemplateRecord {
  id: string;
  userId: string;
  name: string;
  description: string | null;
  baseTemplateId: string | null;
  templateParameters: typeof defaultTemplateParameters;
  isArchived: boolean;
  isPromoted: boolean;
  usageCount: number;
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

describe('TemplatesService', () => {
  let service: TemplatesService;
  let auditEmitted: Array<{
    eventType: string;
    category: string;
    actorUserId: string;
    entityId?: string;
    metadata?: Record<string, unknown>;
  }> = [];

  const mockPrisma = {
    template: {
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn().mockResolvedValue(null),
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockImplementation(({ data }: MockCreateArgs<Partial<MockTemplateRecord>>) =>
        Promise.resolve({
          id: 'template_1',
          ...data,
          version: data.version ?? 1,
          usageCount: data.usageCount ?? 0,
          createdAt: new Date('2026-04-14T00:00:00.000Z'),
          updatedAt: new Date('2026-04-14T00:00:00.000Z'),
        }),
      ),
      update: jest.fn().mockImplementation(({ where, data }: MockUpdateArgs<Partial<MockTemplateRecord>>) =>
        Promise.resolve({
          id: where.id,
          ...data,
          createdAt: new Date('2026-04-14T00:00:00.000Z'),
          updatedAt: new Date('2026-04-14T00:00:00.000Z'),
        }),
      ),
      delete: jest.fn().mockResolvedValue({}),
    },
    userTemplate: {
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockImplementation(({ data }: MockCreateArgs<Partial<MockUserTemplateRecord>>) =>
        Promise.resolve({
          id: 'user_template_1',
          ...data,
          isArchived: data.isArchived ?? false,
          isPromoted: data.isPromoted ?? false,
          usageCount: data.usageCount ?? 0,
          createdAt: new Date('2026-04-14T00:00:00.000Z'),
          updatedAt: new Date('2026-04-14T00:00:00.000Z'),
        }),
      ),
      update: jest.fn().mockImplementation(({ where, data }: MockUpdateArgs<Partial<MockUserTemplateRecord>>) =>
        Promise.resolve({
          id: where.id,
          ...data,
          createdAt: new Date('2026-04-14T00:00:00.000Z'),
          updatedAt: new Date('2026-04-14T00:00:00.000Z'),
        }),
      ),
    },
    workTypeSetting: {
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockImplementation(({ data }: MockCreateArgs<Partial<MockWorkTypeSettingRecord>>) =>
        Promise.resolve({
          id: 'work_type_1',
          ...data,
          createdAt: new Date('2026-04-14T00:00:00.000Z'),
          updatedAt: new Date('2026-04-14T00:00:00.000Z'),
        }),
      ),
      update: jest.fn().mockImplementation(({ where, data }: MockUpdateArgs<Partial<MockWorkTypeSettingRecord>>) =>
        Promise.resolve({
          id: where.id,
          ...data,
          createdAt: new Date('2026-04-14T00:00:00.000Z'),
          updatedAt: new Date('2026-04-14T00:00:00.000Z'),
        }),
      ),
      delete: jest.fn().mockResolvedValue({}),
    },
    $transaction: jest.fn(),
  };

  // Wire $transaction after mockPrisma is fully defined so the callback
  // can pass the same mock object through as the "tx" argument.
  mockPrisma.$transaction.mockImplementation(
    (handler: (tx: typeof mockPrisma) => Promise<unknown>) => handler(mockPrisma),
  );

  const mockAuditEmitter = {
    emit: jest.fn((event: {
      eventType: string;
      category: string;
      actorUserId: string;
      entityId?: string;
      metadata?: Record<string, unknown>;
    }) => {
      auditEmitted.push(event);
    }),
  };

  beforeEach(async () => {
    auditEmitted = [];
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TemplatesService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: AuditEventEmitterService, useValue: mockAuditEmitter },
        {
          provide: ConfigService,
          useValue: { get: () => '', getOrThrow: () => '' },
        },
      ],
    }).compile();

    service = module.get<TemplatesService>(TemplatesService);
  });

  describe('listOfficialTemplates', () => {
    it('returns active templates', async () => {
      mockPrisma.template.findMany.mockResolvedValue([
        {
          id: 't1',
          slug: 'thesis',
          name: 'Thesis',
          description: null,
          category: 'University',
          workType: 'thesis',
          isActive: true,
          version: 1,
          usageCount: 5,
          templateParameters: defaultTemplateParameters,
          createdByUserId: null,
          sourceUserTemplateId: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);

      const result = await service.listOfficialTemplates();
      expect(result).toHaveLength(1);
      expect(result[0].slug).toBe('thesis');
    });

    it('filters by workType', async () => {
      mockPrisma.template.findMany.mockResolvedValue([
        {
          id: 't1',
          slug: 'article',
          name: 'Article',
          description: null,
          category: 'Journal',
          workType: 'article',
          isActive: true,
          version: 1,
          usageCount: 3,
          templateParameters: defaultTemplateParameters,
          createdByUserId: null,
          sourceUserTemplateId: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);

      const result = await service.listOfficialTemplates('article');
      expect(result).toHaveLength(1);
      expect(result[0].workType).toBe('article');
    });
  });

  describe('adminCreateTemplate', () => {
    it('creates a new template', async () => {
      const result = await service.adminCreateTemplate('admin_1', {
        slug: 'ieee-paper',
        name: 'IEEE Paper',
        category: 'Journal',
        workType: 'article',
        description: 'Official IEEE format',
        templateParameters: defaultTemplateParameters,
      });

      expect(result.slug).toBe('ieee-paper');
      expect(result.version).toBe(1);
      expect(
        auditEmitted.some((e) => e.eventType === 'templates.created'),
      ).toBe(true);
    });

    it('throws when slug exists', async () => {
      mockPrisma.template.findUnique.mockResolvedValue({ id: 'existing' });

      await expect(
        service.adminCreateTemplate('admin_1', {
          slug: 'thesis',
          name: 'Duplicate',
          category: 'University',
          workType: 'thesis',
          templateParameters: defaultTemplateParameters,
        }),
      ).rejects.toThrow('Template slug is already in use');
    });
  });

  describe('adminUpdateTemplate', () => {
    it('updates template and increments version', async () => {
      const templateData = {
        id: 't1',
        slug: 'thesis',
        name: 'Thesis',
        description: null,
        category: 'University',
        workType: 'thesis',
        isActive: true,
        isArchived: false,
        version: 1,
        usageCount: 0,
        templateParameters: defaultTemplateParameters,
        createdByUserId: null,
        sourceUserTemplateId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrisma.template.findUnique.mockImplementation(
        ({ where }: { where: { id?: string; slug?: string } }) => {
        if (where.id === 't1' || where.slug === 'thesis') {
          return Promise.resolve(templateData);
        }
        return Promise.resolve(null);
        },
      );

      const result = await service.adminUpdateTemplate('admin_1', 't1', {
        slug: 'thesis',
        name: 'Thesis v2',
        category: 'University',
        workType: 'thesis',
        description: 'Updated',
        isActive: true,
        templateParameters: defaultTemplateParameters,
      });

      expect(result.name).toBe('Thesis v2');
      expect(result.version).toBe(2);
      expect(
        auditEmitted.some((e) => e.eventType === 'templates.updated'),
      ).toBe(true);
    });
  });

  describe('adminDeleteTemplate', () => {
    it('archives template and emits audit event', async () => {
      mockPrisma.template.findUnique.mockResolvedValue({
        id: 't1',
        slug: 'thesis',
        isArchived: false,
      });

      const result = await service.adminDeleteTemplate('admin_1', 't1');
      expect(result).toEqual({ success: true });
      // Immutable delete: soft-archive the row instead of removing it.
      const updateCalls = mockPrisma.template.update.mock.calls as Array<
        [{ where: { id: string }; data: { isArchived: boolean; isActive: boolean } }]
      >;
      const updateCall = updateCalls[0]?.[0];
      expect(updateCall).toBeDefined();
      expect(updateCall?.where).toEqual({ id: 't1' });
      expect(updateCall?.data).toMatchObject({ isArchived: true, isActive: false });
      expect(mockPrisma.template.delete).not.toHaveBeenCalled();
      expect(
        auditEmitted.some((e) => e.eventType === 'templates.deleted'),
      ).toBe(true);
    });
  });

  describe('createUserTemplate', () => {
    it('creates user template', async () => {
      const result = await service.createUserTemplate('user_1', {
        name: 'My Custom Format',
        description: 'Personal style',
        templateParameters: defaultTemplateParameters,
      });

      expect(result.name).toBe('My Custom Format');
      expect(result.userId).toBe('user_1');
      expect(
        auditEmitted.some((e) => e.eventType === 'user_templates.created'),
      ).toBe(true);
    });

    it('links to base template when provided', async () => {
      mockPrisma.template.findUnique.mockResolvedValue({ id: 'base_1' });

      const result = await service.createUserTemplate('user_1', {
        name: 'Cloned Template',
        baseTemplateId: 'base_1',
        templateParameters: defaultTemplateParameters,
      });

      expect(result.baseTemplateId).toBe('base_1');
    });
  });

  describe('cloneOfficialTemplate', () => {
    it('clones template and increments usage count', async () => {
      mockPrisma.template.findUnique.mockResolvedValue({
        id: 't1',
        name: 'Thesis',
        description: 'Desc',
        templateParameters: defaultTemplateParameters,
        usageCount: 5,
        isArchived: false,
      });

      const result = await service.cloneOfficialTemplate('user_1', 't1', {
        name: 'My Thesis',
      });

      expect(result.name).toBe('My Thesis');
      expect(result.baseTemplateId).toBe('t1');
      expect(mockPrisma.template.update).toHaveBeenCalledWith({
        where: { id: 't1' },
        data: { usageCount: 6 },
      });
    });
  });

  describe('updateUserTemplate', () => {
    it('updates user template', async () => {
      mockPrisma.userTemplate.findUnique.mockResolvedValue({
        id: 'ut1',
        userId: 'user_1',
        isArchived: false,
        templateParameters: defaultTemplateParameters,
      });

      const result = await service.updateUserTemplate('user_1', 'ut1', {
        name: 'Updated Name',
        description: 'Updated desc',
        templateParameters: defaultTemplateParameters,
      });

      expect(result.name).toBe('Updated Name');
    });

    it('rejects archived templates', async () => {
      mockPrisma.userTemplate.findUnique.mockResolvedValue({
        id: 'ut1',
        userId: 'user_1',
        isArchived: true,
      });

      await expect(
        service.updateUserTemplate('user_1', 'ut1', {
          name: 'Test',
          templateParameters: defaultTemplateParameters,
        }),
      ).rejects.toThrow('User template was not found');
    });
  });

  describe('archiveUserTemplate', () => {
    it('archives user template', async () => {
      mockPrisma.userTemplate.findUnique.mockResolvedValue({
        id: 'ut1',
        userId: 'user_1',
        isArchived: false,
      });

      const result = await service.archiveUserTemplate('user_1', 'ut1');
      expect(result).toEqual({ success: true });
      expect(mockPrisma.userTemplate.update).toHaveBeenCalledWith({
        where: { id: 'ut1' },
        data: { isArchived: true },
      });
    });
  });

  describe('adminPromoteUserTemplate', () => {
    it('promotes user template to official', async () => {
      mockPrisma.userTemplate.findUnique.mockResolvedValue({
        id: 'ut1',
        name: 'User Template',
        description: 'Desc',
        templateParameters: defaultTemplateParameters,
        isArchived: false,
      });
      mockPrisma.template.findUnique.mockResolvedValue(null);

      const result = await service.adminPromoteUserTemplate('admin_1', 'ut1', {
        slug: 'promoted-template',
        category: 'University',
        workType: 'thesis',
      });

      expect(result.slug).toBe('promoted-template');
      expect(
        auditEmitted.some((e) => e.eventType === 'user_templates.promoted'),
      ).toBe(true);
    });
  });

  describe('adminCreateWorkTypeSetting', () => {
    it('creates work type setting', async () => {
      const result = await service.adminCreateWorkTypeSetting('admin_1', {
        slug: 'report',
        label: 'Report',
        isActive: true,
        requiredFixedPages: ['abstract'],
        optionalFixedPages: ['appendix'],
      });

      expect(result.slug).toBe('report');
      expect(result.requiredFixedPages).toEqual(['abstract']);
      expect(result.optionalFixedPages).toEqual(['appendix']);
    });
  });

  describe('adminExportTemplates', () => {
    it('returns export structure', async () => {
      mockPrisma.template.findMany.mockResolvedValue([]);
      mockPrisma.userTemplate.findMany.mockResolvedValue([]);

      const result = await service.adminExportTemplates();
      expect(result).toHaveProperty('exportedAt');
      expect(result).toHaveProperty('officialTemplates');
      expect(result).toHaveProperty('userTemplates');
    });
  });

  describe('adminImportTemplates', () => {
    it('creates new templates and skips existing', async () => {
      mockPrisma.template.findUnique.mockResolvedValue(null);

      const result = await service.adminImportTemplates('admin_1', {
        officialTemplates: [
          {
            slug: 'new-template',
            name: 'New Template',
            category: 'University',
            workType: 'thesis',
            templateParameters: defaultTemplateParameters,
          },
        ],
      });

      expect(result.success).toBe(true);
      expect(result.createdCount).toBe(1);
    });
  });

  describe('adminTemplateStats', () => {
    it('returns stats structure', async () => {
      mockPrisma.template.findMany.mockResolvedValue([
        {
          id: 't1',
          slug: 'thesis',
          name: 'Thesis',
          description: null,
          category: 'University',
          workType: 'thesis',
          isActive: true,
          version: 1,
          usageCount: 10,
          templateParameters: defaultTemplateParameters,
          createdByUserId: null,
          sourceUserTemplateId: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);
      mockPrisma.userTemplate.findMany.mockResolvedValue([]);

      const result = await service.adminTemplateStats();
      expect(result).toHaveProperty('officialCount', 1);
      expect(result).toHaveProperty('userTemplateCount', 0);
      expect(result).toHaveProperty('topOfficialTemplates');
    });
  });

  describe('listActiveWorkTypeSettings', () => {
    it('returns active work types', async () => {
      mockPrisma.workTypeSetting.findMany.mockResolvedValue([
        {
          id: 'wt1',
          slug: 'thesis',
          label: 'Thesis',
          isActive: true,
          requiredFixedPages: ['abstract'],
          optionalFixedPages: ['appendix'],
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);

      const result = await service.listActiveWorkTypeSettings();
      expect(result).toHaveLength(1);
      expect(result[0].slug).toBe('thesis');
    });
  });

  describe('getOfficialTemplate', () => {
    it('returns template by id', async () => {
      mockPrisma.template.findUnique.mockResolvedValue({
        id: 't1',
        slug: 'thesis',
        name: 'Thesis',
        description: null,
        category: 'University',
        workType: 'thesis',
        isActive: true,
        version: 1,
        usageCount: 5,
        templateParameters: defaultTemplateParameters,
        createdByUserId: null,
        sourceUserTemplateId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await service.getOfficialTemplate('t1');
      expect(result.id).toBe('t1');
    });

    it('throws when not found', async () => {
      mockPrisma.template.findUnique.mockResolvedValue(null);

      await expect(service.getOfficialTemplate('nonexistent')).rejects.toThrow(
        'Template was not found',
      );
    });
  });
});
