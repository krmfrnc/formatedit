import type { LegalDocumentSlug } from '@prisma/client';
import { LegalDocumentsService } from '../src/modules/admin/services/legal-documents.service';

interface MockLegalDocument {
  id: string;
  slug: LegalDocumentSlug;
  locale: string;
  title: string;
  content: string;
  version: number;
  isActive: boolean;
  publishedAt: Date | null;
  updatedAt: Date;
  updatedBy: string | null;
  createdAt: Date;
}

interface FindFirstArgs {
  where: {
    slug?: LegalDocumentSlug;
    locale?: string;
    isActive?: boolean;
    publishedAt?: { not: null };
  };
  orderBy?: { version?: 'desc' | 'asc' };
}

interface FindManyArgs {
  where?: {
    slug?: LegalDocumentSlug;
    locale?: string;
  };
}

interface CreateArgs {
  data: {
    slug: LegalDocumentSlug;
    locale: string;
    title: string;
    content: string;
    version: number;
    isActive: boolean;
    publishedAt: Date | null;
    updatedBy?: string;
  };
}

interface FindUniqueArgs {
  where: { id: string };
}

interface UpdateManyArgs {
  where: {
    slug: LegalDocumentSlug;
    locale: string;
    NOT: { id: string };
  };
  data: { isActive: boolean };
}

interface UpdateArgs {
  where: { id: string };
  data: Partial<MockLegalDocument>;
}

describe('LegalDocumentsService', () => {
  const legalDocuments: MockLegalDocument[] = [];

  const prisma = {
    legalDocument: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  const service = new LegalDocumentsService(prisma as never);

  beforeEach(() => {
    legalDocuments.length = 0;
    prisma.legalDocument.findFirst.mockReset();
    prisma.legalDocument.findMany.mockReset();
    prisma.legalDocument.create.mockReset();
    prisma.legalDocument.findUnique.mockReset();
    prisma.legalDocument.update.mockReset();
    prisma.legalDocument.updateMany.mockReset();
    prisma.$transaction.mockReset();

    prisma.legalDocument.findFirst.mockImplementation(({ where, orderBy }: FindFirstArgs) => {
      const filtered = legalDocuments.filter((item) => {
        if (where.slug && item.slug !== where.slug) return false;
        if (where.locale && item.locale !== where.locale) return false;
        if (where.isActive != null && item.isActive !== where.isActive) return false;
        if (where.publishedAt?.not === null && item.publishedAt === null) return false;
        return true;
      });

      if (orderBy?.version === 'desc') {
        return Promise.resolve(filtered.sort((a, b) => b.version - a.version)[0] ?? null);
      }

      return Promise.resolve(filtered[0] ?? null);
    });

    prisma.legalDocument.findMany.mockImplementation(({ where }: FindManyArgs) =>
      Promise.resolve(
        legalDocuments.filter((item) => {
          if (where?.slug && item.slug !== where.slug) return false;
          if (where?.locale && item.locale !== where.locale) return false;
          return true;
        }),
      ),
    );

    prisma.legalDocument.create.mockImplementation(({ data }: CreateArgs) => {
      const created: MockLegalDocument = {
        id: `legal_${legalDocuments.length + 1}`,
        slug: data.slug,
        locale: data.locale,
        title: data.title,
        content: data.content,
        version: data.version,
        isActive: data.isActive,
        publishedAt: data.publishedAt,
        updatedBy: data.updatedBy ?? null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      legalDocuments.push(created);
      return Promise.resolve(created);
    });

    prisma.legalDocument.findUnique.mockImplementation(({ where }: FindUniqueArgs) =>
      Promise.resolve(legalDocuments.find((item) => item.id === where.id) ?? null),
    );

    prisma.legalDocument.updateMany.mockImplementation(({ where, data }: UpdateManyArgs) => {
      for (const item of legalDocuments) {
        if (item.slug === where.slug && item.locale === where.locale && item.id !== where.NOT.id) {
          item.isActive = data.isActive;
        }
      }
      return Promise.resolve({ count: 1 });
    });

    prisma.legalDocument.update.mockImplementation(({ where, data }: UpdateArgs) => {
      const item = legalDocuments.find((entry) => entry.id === where.id);
      if (!item) {
        return Promise.resolve(null);
      }

      Object.assign(item, data, { updatedAt: new Date() });
      return Promise.resolve(item);
    });

    prisma.$transaction.mockImplementation((callback: (tx: typeof prisma) => unknown) =>
      callback(prisma),
    );
  });

  it('creates and publishes a GDPR draft', async () => {
    const draft = await service.createDraft(
      {
        slug: 'GDPR',
        locale: 'tr',
        title: 'GDPR Bilgilendirmesi',
        content: 'Test icerigi',
      },
      'admin_1',
    );

    expect(draft.slug).toBe('GDPR');
    expect(draft.version).toBe(1);

    const published = await service.publish(draft.id, 'admin_1');

    expect(published?.isActive).toBe(true);
    expect((await service.getActive('GDPR', 'tr'))?.title).toBe('GDPR Bilgilendirmesi');
  });
});
