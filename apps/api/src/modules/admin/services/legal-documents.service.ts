import { Injectable, NotFoundException } from '@nestjs/common';
import type { LegalDocument, LegalDocumentSlug } from '@prisma/client';
import { PrismaService } from '../../../prisma.service';

export interface UpsertLegalDocumentInput {
  slug: LegalDocumentSlug;
  locale?: string;
  title: string;
  content: string;
}

/**
 * Task 289 + Batch 13 legal pages: Versioned legal document store
 * (Terms, Privacy, KVKK, GDPR, Cookies).
 *
 * Editing creates a new row with `version = max(existing) + 1` and leaves
 * older versions in place for audit/history. Publishing toggles `isActive`
 * atomically: the newly published version becomes the only active one for
 * that (slug, locale) pair.
 */
@Injectable()
export class LegalDocumentsService {
  constructor(private readonly prismaService: PrismaService) {}

  async list(slug?: LegalDocumentSlug, locale?: string): Promise<LegalDocument[]> {
    return this.prismaService.legalDocument.findMany({
      where: {
        ...(slug ? { slug } : {}),
        ...(locale ? { locale } : {}),
      },
      orderBy: [{ slug: 'asc' }, { locale: 'asc' }, { version: 'desc' }],
    });
  }

  async getActive(slug: LegalDocumentSlug, locale = 'tr'): Promise<LegalDocument | null> {
    return this.prismaService.legalDocument.findFirst({
      where: { slug, locale, isActive: true, publishedAt: { not: null } },
      orderBy: { version: 'desc' },
    });
  }

  async createDraft(input: UpsertLegalDocumentInput, updatedBy: string | null): Promise<LegalDocument> {
    const locale = input.locale ?? 'tr';
    const latest = await this.prismaService.legalDocument.findFirst({
      where: { slug: input.slug, locale },
      orderBy: { version: 'desc' },
    });
    const nextVersion = (latest?.version ?? 0) + 1;
    return this.prismaService.legalDocument.create({
      data: {
        slug: input.slug,
        locale,
        title: input.title,
        content: input.content,
        version: nextVersion,
        isActive: false,
        publishedAt: null,
        updatedBy: updatedBy ?? undefined,
      },
    });
  }

  async publish(id: string, updatedBy: string | null): Promise<LegalDocument> {
    const doc = await this.prismaService.legalDocument.findUnique({ where: { id } });
    if (!doc) throw new NotFoundException('Legal document not found');

    return this.prismaService.$transaction(async (tx) => {
      // Deactivate previously-active versions for the same (slug, locale).
      await tx.legalDocument.updateMany({
        where: { slug: doc.slug, locale: doc.locale, isActive: true, NOT: { id } },
        data: { isActive: false },
      });
      return tx.legalDocument.update({
        where: { id },
        data: {
          isActive: true,
          publishedAt: doc.publishedAt ?? new Date(),
          updatedBy: updatedBy ?? undefined,
        },
      });
    });
  }

  async unpublish(id: string, updatedBy: string | null): Promise<LegalDocument> {
    const doc = await this.prismaService.legalDocument.findUnique({ where: { id } });
    if (!doc) throw new NotFoundException('Legal document not found');
    return this.prismaService.legalDocument.update({
      where: { id },
      data: { isActive: false, updatedBy: updatedBy ?? undefined },
    });
  }
}
