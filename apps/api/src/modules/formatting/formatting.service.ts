import { Injectable } from '@nestjs/common';
import { appLogger } from '../../common/logger';
import { PrismaService } from '../../prisma.service';
import {
  defaultHeadingLevels,
  defaultPageLayout,
  defaultTypography,
  maxFormattingErrors,
} from './formatting.constants';
import type {
  FormattingResult,
  FormattingRule,
  FormattingValidationError,
  HeadingStyleLevel,
  HeadingStyleSettings,
  PageLayoutSettings,
  TypographySettings,
} from './formatting.types';

type DocumentBlock = Record<string, unknown>;

@Injectable()
export class FormattingService {
  constructor(private readonly prismaService: PrismaService) {}

  async applyFormatting(
    documentId: string,
    documentVersionId: string,
    templateParameters: Record<string, unknown>,
  ): Promise<FormattingResult> {
    const startedAt = Date.now();
    const errors: FormattingValidationError[] = [];
    const warnings: FormattingValidationError[] = [];

    try {
      const blocks = await this.fetchDocumentBlocks(documentVersionId);

      const validationErrors = this.validateDocument(blocks);
      errors.push(
        ...validationErrors.filter((error) => error.severity === 'ERROR'),
      );
      warnings.push(
        ...validationErrors.filter((error) => error.severity === 'WARNING'),
      );

      if (errors.length >= maxFormattingErrors) {
        return {
          success: false,
          errors,
          warnings,
          formattedBlocks: [],
          documentId,
          documentVersionId,
          durationMs: Date.now() - startedAt,
        };
      }

      const pageLayout = this.extractPageLayoutSettings(templateParameters);
      const typography = this.extractTypographySettings(templateParameters);
      const headingStyles =
        this.extractHeadingStyleSettings(templateParameters);

      const formattedBlocks = blocks.map((block, index) => {
        const appliedRules: FormattingRule['type'][] = [];

        this.applyPageLayoutToBlock(block, pageLayout, appliedRules);
        this.applyTypographyToBlock(block, typography, appliedRules);
        this.applyHeadingStylesToBlock(block, headingStyles, appliedRules);

        return {
          orderIndex: index,
          blockType: block.blockType as string,
          appliedRules,
          text: block.text as string,
        };
      });

      appLogger.info('Formatting applied', {
        documentId,
        documentVersionId,
        durationMs: Date.now() - startedAt,
        totalBlocks: formattedBlocks.length,
        errorCount: errors.length,
        warningCount: warnings.length,
      });

      return {
        success: errors.length === 0,
        errors,
        warnings,
        formattedBlocks,
        documentId,
        documentVersionId,
        durationMs: Date.now() - startedAt,
      };
    } catch (error) {
      appLogger.error('Formatting failed', {
        documentId,
        documentVersionId,
        durationMs: Date.now() - startedAt,
        error:
          error instanceof Error ? error.message : 'Unknown formatting error',
      });

      return {
        success: false,
        errors: [
          {
            severity: 'ERROR',
            code: 'FORMATTING_ENGINE_ERROR',
            message:
              error instanceof Error
                ? error.message
                : 'Unknown formatting error',
          },
        ],
        warnings,
        formattedBlocks: [],
        documentId,
        documentVersionId,
        durationMs: Date.now() - startedAt,
      };
    }
  }

  validateDocument(blocks: unknown[]): FormattingValidationError[] {
    const errors: FormattingValidationError[] = [];

    if (!blocks.length) {
      errors.push({
        severity: 'ERROR',
        code: 'EMPTY_DOCUMENT',
        message: 'Document contains no blocks to format',
      });
      return errors;
    }

    blocks.forEach((block, index) => {
      if (!block || typeof block !== 'object') {
        errors.push({
          severity: 'ERROR',
          code: 'INVALID_BLOCK',
          message: `Block at index ${index} is not a valid object`,
          blockIndex: index,
        });
        return;
      }

      const blockRecord = block as Record<string, unknown>;

      if (typeof blockRecord.blockType !== 'string') {
        errors.push({
          severity: 'ERROR',
          code: 'MISSING_BLOCK_TYPE',
          message: `Block at index ${index} is missing a valid blockType`,
          blockIndex: index,
        });
      }

      if (typeof blockRecord.text !== 'string') {
        errors.push({
          severity: 'WARNING',
          code: 'MISSING_BLOCK_TEXT',
          message: `Block at index ${index} is missing text content`,
          blockIndex: index,
        });
      }

      if (
        'level' in blockRecord &&
        blockRecord.level !== null &&
        typeof blockRecord.level !== 'number'
      ) {
        errors.push({
          severity: 'WARNING',
          code: 'INVALID_HEADING_LEVEL',
          message: `Block at index ${index} has an invalid heading level`,
          blockIndex: index,
        });
      }
    });

    return errors;
  }

  getWordCount(blocks: unknown[]): number {
    let total = 0;

    for (const block of blocks) {
      if (!block || typeof block !== 'object') {
        continue;
      }

      const blockRecord = block as Record<string, unknown>;
      const text = blockRecord.text;

      if (typeof text !== 'string' || !text.trim()) {
        continue;
      }

      total += text.trim().split(/\s+/).length;
    }

    return total;
  }

  private async fetchDocumentBlocks(
    documentVersionId: string,
  ): Promise<DocumentBlock[]> {
    const sections = await this.prismaService.documentSection.findMany({
      where: { documentVersionId },
      orderBy: [{ orderIndex: 'asc' }, { createdAt: 'asc' }],
    });

    return sections.map((section) => ({
      orderIndex: section.orderIndex,
      blockType: section.sectionType,
      text: ((section.content ?? {}) as Record<string, unknown>).text ?? '',
      level: section.level,
      title: section.title,
      confidenceScore: section.confidenceScore,
    }));
  }

  private extractPageLayoutSettings(
    parameters: Record<string, unknown>,
  ): PageLayoutSettings {
    const pageLayout = (parameters.pageLayout ?? {}) as Record<string, unknown>;

    return {
      paperSize:
        (pageLayout.paperSize as string) ?? defaultPageLayout.paperSize,
      orientation:
        (pageLayout.orientation as 'portrait' | 'landscape') ??
        defaultPageLayout.orientation,
      marginTopCm:
        (pageLayout.marginTopCm as number) ?? defaultPageLayout.marginTopCm,
      marginBottomCm:
        (pageLayout.marginBottomCm as number) ??
        defaultPageLayout.marginBottomCm,
      marginLeftCm:
        (pageLayout.marginLeftCm as number) ?? defaultPageLayout.marginLeftCm,
      marginRightCm:
        (pageLayout.marginRightCm as number) ?? defaultPageLayout.marginRightCm,
      headerMarginCm:
        (pageLayout.headerMarginCm as number) ??
        defaultPageLayout.headerMarginCm,
      footerMarginCm:
        (pageLayout.footerMarginCm as number) ??
        defaultPageLayout.footerMarginCm,
      gutterCm: (pageLayout.gutterCm as number) ?? defaultPageLayout.gutterCm,
    };
  }

  private extractTypographySettings(
    parameters: Record<string, unknown>,
  ): TypographySettings {
    const typography = (parameters.typography ?? {}) as Record<string, unknown>;

    return {
      fontFamily:
        (typography.fontFamily as string) ?? defaultTypography.fontFamily,
      fontSizePt:
        (typography.fontSizePt as number) ?? defaultTypography.fontSizePt,
      lineSpacing:
        (typography.lineSpacing as number) ?? defaultTypography.lineSpacing,
      paragraphSpacingBeforePt:
        (typography.paragraphSpacingBeforePt as number) ??
        defaultTypography.paragraphSpacingBeforePt,
      paragraphSpacingAfterPt:
        (typography.paragraphSpacingAfterPt as number) ??
        defaultTypography.paragraphSpacingAfterPt,
      alignment:
        (typography.alignment as 'left' | 'center' | 'right' | 'justify') ??
        defaultTypography.alignment,
      firstLineIndentCm:
        (typography.firstLineIndentCm as number) ??
        defaultTypography.firstLineIndentCm,
    };
  }

  private extractHeadingStyleSettings(
    parameters: Record<string, unknown>,
  ): HeadingStyleSettings {
    const headingHierarchy = (parameters.headingHierarchy ?? {}) as Record<
      string,
      unknown
    >;

    const levels =
      (headingHierarchy.levels as HeadingStyleLevel[]) ?? defaultHeadingLevels;

    return { levels };
  }

  private applyPageLayoutToBlock(
    block: DocumentBlock,
    _settings: PageLayoutSettings,
    appliedRules: FormattingRule['type'][],
  ): void {
    if (block.blockType === 'HEADING' || block.blockType === 'PARAGRAPH') {
      appliedRules.push('PAGE_LAYOUT');
    }
  }

  private applyTypographyToBlock(
    block: DocumentBlock,
    _settings: TypographySettings,
    appliedRules: FormattingRule['type'][],
  ): void {
    if (block.blockType === 'HEADING' || block.blockType === 'PARAGRAPH') {
      appliedRules.push('TYPOGRAPHY');
    }
  }

  private applyHeadingStylesToBlock(
    block: DocumentBlock,
    settings: HeadingStyleSettings,
    appliedRules: FormattingRule['type'][],
  ): void {
    if (block.blockType !== 'HEADING') {
      return;
    }

    const level = (block.level as number | null) ?? 1;
    const headingLevel = settings.levels.find((entry) => entry.level === level);

    if (headingLevel) {
      appliedRules.push('HEADING_STYLE');
    }
  }
}
