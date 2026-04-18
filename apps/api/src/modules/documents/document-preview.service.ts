import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { DocumentPreviewBlock, DocumentPreviewState, ParsedDocumentBlock } from '@formatedit/shared';
import { PrismaService } from '../../prisma.service';
import { DocumentPreviewGateway } from './document-preview.gateway';

@Injectable()
export class DocumentPreviewService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly documentPreviewGateway: DocumentPreviewGateway,
  ) {}

  async renderAndPersistPreview(documentId: string, sourceVersionId: string): Promise<DocumentPreviewState> {
    const sourceVersion = await this.prismaService.documentVersion.findUnique({
      where: { id: sourceVersionId },
    });

    if (!sourceVersion || sourceVersion.documentId !== documentId) {
      throw new NotFoundException('Source version for preview was not found');
    }

    const sourceMetadata = (sourceVersion.metadata ?? {}) as Record<string, unknown>;
    let sourceBlocks = Array.isArray(sourceMetadata.blocks)
      ? (sourceMetadata.blocks as ParsedDocumentBlock[])
      : [];

    if (!sourceBlocks.length) {
      const sections = await this.prismaService.documentSection.findMany({
        where: {
          documentId,
          documentVersionId: sourceVersionId,
        },
        orderBy: [{ orderIndex: 'asc' }, { createdAt: 'asc' }],
      });

      sourceBlocks = sections.map((section, index) => {
        const content = (section.content ?? {}) as Record<string, unknown>;
        const text = typeof content.text === 'string' ? content.text : section.title ?? '';
        const blockType = (section.sectionType || 'PARAGRAPH') as ParsedDocumentBlock['blockType'];

        return {
          orderIndex: index,
          blockType,
          semanticSectionType: ((content.semanticSectionType as string | undefined) ??
            'BODY') as ParsedDocumentBlock['semanticSectionType'],
          title: section.title,
          text,
          level: blockType === 'HEADING' ? (section.level ?? 1) : null,
          confidenceScore:
            typeof section.confidenceScore === 'number' ? section.confidenceScore : 0.95,
          numberingPattern: (content.numberingPattern as string | undefined) ?? null,
          lineLengthScore: text.length <= 120 ? 1 : 0.65,
          hasCitation: Boolean(content.hasCitation),
          hasFootnote: Boolean(content.hasFootnote),
          hasEquation: Boolean(content.hasEquation),
          tableOrFigureLabel: (content.tableOrFigureLabel as string | undefined) ?? null,
          templateSlot: (content.templateSlot as string | undefined) ?? null,
          numberingOverride: null,
          manualSequenceNumber: null,
        };
      });
    }

    if (!sourceBlocks.length) {
      throw new NotFoundException('Preview blocks are not available');
    }

    const previewBlocks = sourceBlocks.map((block) => this.toPreviewBlock(block));
    const updatedAt = new Date().toISOString();

    const previewVersion = await this.prismaService.documentVersion.upsert({
      where: {
        id: `${documentId}_preview`,
      },
      update: {
        label: 'Live editor preview',
        metadata: {
          blocks: sourceBlocks,
          preview: {
            status: 'ready',
            sourceVersionId,
            updatedAt,
            blocks: previewBlocks,
          },
        } as unknown as Prisma.InputJsonValue,
      },
      create: {
        id: `${documentId}_preview`,
        documentId,
        type: 'PREVIEW',
        label: 'Live editor preview',
        metadata: {
          blocks: sourceBlocks,
          preview: {
            status: 'ready',
            sourceVersionId,
            updatedAt,
            blocks: previewBlocks,
          },
        } as unknown as Prisma.InputJsonValue,
      },
    });

    const previewState: DocumentPreviewState = {
      documentId,
      sourceVersionId,
      previewVersionId: previewVersion.id,
      status: 'ready',
      updatedAt,
      blocks: previewBlocks,
    };

    this.documentPreviewGateway.emitPreviewUpdated(documentId, previewState);
    return previewState;
  }

  async getPreviewState(documentId: string): Promise<DocumentPreviewState | null> {
    const previewVersion = await this.prismaService.documentVersion.findFirst({
      where: {
        documentId,
        type: 'PREVIEW',
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    if (!previewVersion) {
      return null;
    }

    const metadata = (previewVersion.metadata ?? {}) as Record<string, unknown>;
    const preview = metadata.preview as Record<string, unknown> | undefined;
    const previewBlocks = Array.isArray(preview?.blocks)
      ? (preview?.blocks as DocumentPreviewBlock[])
      : [];

    if (!preview || !previewBlocks.length || typeof preview.sourceVersionId !== 'string') {
      return null;
    }

    return {
      documentId,
      sourceVersionId: preview.sourceVersionId,
      previewVersionId: previewVersion.id,
      status: preview.status === 'queued' ? 'queued' : 'ready',
      updatedAt: typeof preview.updatedAt === 'string' ? preview.updatedAt : previewVersion.createdAt.toISOString(),
      blocks: previewBlocks,
    };
  }

  private toPreviewBlock(block: ParsedDocumentBlock): DocumentPreviewBlock {
    const trimmedText = block.text.trim();
    const displayText = block.blockType === 'HEADING' && block.title ? block.title : trimmedText;

    return {
      orderIndex: block.orderIndex,
      blockType: block.blockType,
      title: block.title,
      text: block.text,
      displayText,
    };
  }
}
