import { Injectable } from '@nestjs/common';
import { appLogger } from '../../common/logger';
import { PrismaService } from '../../prisma.service';
import {
  defaultFixedPages,
  defaultPageLayout,
  defaultPageNumbering,
  defaultRestrictions,
  defaultSectionOrder,
  defaultSequenceNumbering,
  defaultTableFigureFormat,
  defaultTypography,
  defaultHeadingLevels,
  maxFormattingErrors,
} from './formatting.constants';
import type {
  FormattedBlock,
  FormattedBlockMetadata,
  FormattingPipelineContext,
  FormattingResult,
  FormattingValidationError,
  HeadingStyleLevel,
  HeadingStyleSettings,
  PageLayoutSettings,
  PageNumberingSettings,
  RestrictionSettings,
  SectionOrderSettings,
  SequenceNumberingSettings,
  TableFigureFormatSettings,
  TypographySettings,
  WizardData,
} from './formatting.types';
import { PageLayoutApplierService } from './page-layout-applier.service';
import { TypographyApplierService } from './typography-applier.service';
import { HeadingStyleApplierService } from './heading-style-applier.service';
import { SequenceNumberingApplierService } from './sequence-numbering-applier.service';
import { CrossReferenceUpdaterService } from './cross-reference-updater.service';
import { SectionOrderApplierService } from './section-order-applier.service';
import { PageNumberingApplierService } from './page-numbering-applier.service';
import { ValidationCheckerService } from './validation-checker.service';
import { CoverPageGeneratorService } from './cover-page-generator.service';
import { ApprovalPageGeneratorService } from './approval-page-generator.service';
import { DeclarationGeneratorService } from './declaration-generator.service';
import { AbstractPageGeneratorService } from './abstract-page-generator.service';
import { TableOfContentsGeneratorService } from './table-of-contents-generator.service';
import { TableListGeneratorService } from './table-list-generator.service';
import { FigureListGeneratorService } from './figure-list-generator.service';
import { AbbreviationsGeneratorService } from './abbreviations-generator.service';
import { CVGeneratorService } from './cv-generator.service';

type DocumentBlock = Record<string, unknown>;

@Injectable()
export class FormattingService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly pageLayoutApplier: PageLayoutApplierService,
    private readonly typographyApplier: TypographyApplierService,
    private readonly headingStyleApplier: HeadingStyleApplierService,
    private readonly sequenceNumberingApplier: SequenceNumberingApplierService,
    private readonly crossReferenceUpdater: CrossReferenceUpdaterService,
    private readonly sectionOrderApplier: SectionOrderApplierService,
    private readonly pageNumberingApplier: PageNumberingApplierService,
    private readonly validationChecker: ValidationCheckerService,
    private readonly coverPageGenerator: CoverPageGeneratorService,
    private readonly approvalPageGenerator: ApprovalPageGeneratorService,
    private readonly declarationGenerator: DeclarationGeneratorService,
    private readonly abstractPageGenerator: AbstractPageGeneratorService,
    private readonly tocGenerator: TableOfContentsGeneratorService,
    private readonly tableListGenerator: TableListGeneratorService,
    private readonly figureListGenerator: FigureListGeneratorService,
    private readonly abbreviationsGenerator: AbbreviationsGeneratorService,
    private readonly cvGenerator: CVGeneratorService,
  ) {}

  /**
   * Main formatting pipeline. Applies all formatting rules to the document
   * blocks and generates fixed pages. Returns the fully formatted block list
   * and all generated pages.
   */
  async applyFormatting(
    documentId: string,
    documentVersionId: string,
    templateParameters: Record<string, unknown>,
    wizardData: WizardData = {},
  ): Promise<FormattingResult> {
    const startedAt = Date.now();

    try {
      // 1. Build pipeline context from template parameters
      const context = this.buildPipelineContext(
        documentId,
        documentVersionId,
        '',
        '',
        templateParameters,
        wizardData,
      );

      // 2. Fetch raw document blocks from database
      const rawBlocks = await this.fetchDocumentBlocks(documentVersionId);

      // 3. Pre-validation: check if document has content
      const preValidationErrors = this.preValidate(rawBlocks);
      context.errors.push(
        ...preValidationErrors.filter((e) => e.severity === 'ERROR'),
      );
      context.warnings.push(
        ...preValidationErrors.filter((e) => e.severity === 'WARNING'),
      );

      if (context.errors.length >= maxFormattingErrors) {
        return this.buildResult(context, [], [], startedAt);
      }

      // 4. Convert raw blocks to FormattedBlock[]
      let blocks = this.toFormattedBlocks(rawBlocks);

      // ─── Pipeline ───

      // 5. Apply page layout metadata to all blocks
      blocks = this.pageLayoutApplier.applyPageLayout(
        blocks,
        context.pageLayout,
      );

      // 6. Apply typography metadata to all blocks
      blocks = this.typographyApplier.applyTypography(
        blocks,
        context.typography,
      );

      // 7. Apply heading styles (5-level hierarchy)
      blocks = this.headingStyleApplier.applyHeadingStyles(
        blocks,
        context.headingStyles,
      );

      // 8. Apply sequence numbering (table/figure/equation)
      blocks = this.sequenceNumberingApplier.applySequenceNumbering(
        blocks,
        context.sequenceNumbering,
        this.getCurrentChapterBlocks(blocks),
      );

      // 9. Update cross-references
      blocks = this.crossReferenceUpdater.updateCrossReferences(blocks);

      // 10. Apply section ordering
      blocks = this.sectionOrderApplier.applySectionOrder(
        blocks,
        context.sectionOrder.order,
      );

      // 11. Generate fixed pages (cover, approval, declaration, abstract, etc.)
      const generatedPages = this.generateFixedPages(context, blocks);

      // 12. Apply page numbering (uses zones from context)
      blocks = this.pageNumberingApplier.applyPageNumbering(
        blocks,
        context.pageNumbering,
      );

      // 13. Validation checks
      const validationIssues = this.validationChecker.runValidationChecks(
        [...generatedPages, ...blocks],
        templateParameters,
        context.restrictions,
      );

      context.errors.push(
        ...validationIssues.filter((e) => e.severity === 'ERROR'),
      );
      context.warnings.push(
        ...validationIssues.filter((e) => e.severity === 'WARNING'),
      );
      context.infos.push(
        ...validationIssues.filter((e) => e.severity === 'INFO'),
      );

      appLogger.info('Formatting pipeline completed', {
        documentId,
        documentVersionId,
        durationMs: Date.now() - startedAt,
        contentBlocks: blocks.length,
        generatedPages: generatedPages.length,
        errorCount: context.errors.length,
        warningCount: context.warnings.length,
      });

      return this.buildResult(context, blocks, generatedPages, startedAt);
    } catch (error) {
      appLogger.error('Formatting pipeline failed', {
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
        warnings: [],
        infos: [],
        formattedBlocks: [],
        generatedPages: [],
        documentId,
        documentVersionId,
        durationMs: Date.now() - startedAt,
      };
    }
  }

  /**
   * Validate raw blocks before processing.
   */
  preValidate(blocks: unknown[]): FormattingValidationError[] {
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
    });

    return errors;
  }

  /**
   * Simple word count calculation for blocks.
   */
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

  // ─── Private helpers ────────────────────────

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
      semanticSectionType:
        ((section.content ?? {}) as Record<string, unknown>)
          .semanticSectionType ?? null,
    }));
  }

  private toFormattedBlocks(rawBlocks: DocumentBlock[]): FormattedBlock[] {
    return rawBlocks.map((block, index) => ({
      orderIndex: index,
      blockType: (block.blockType as string) ?? 'PARAGRAPH',
      appliedRules: [],
      text: (block.text as string) ?? '',
      metadata: {
        semanticSectionType:
          (block.semanticSectionType as string) ?? undefined,
      } as FormattedBlockMetadata,
    }));
  }

  private buildPipelineContext(
    documentId: string,
    documentVersionId: string,
    templateId: string,
    requestedBy: string,
    params: Record<string, unknown>,
    wizardData: WizardData,
  ): FormattingPipelineContext {
    return {
      documentId,
      documentVersionId,
      templateId,
      requestedBy,
      pageLayout: this.extractPageLayout(params),
      typography: this.extractTypography(params),
      headingStyles: this.extractHeadingStyles(params),
      pageNumbering: this.extractPageNumbering(params),
      sequenceNumbering: this.extractSequenceNumbering(params),
      sectionOrder: this.extractSectionOrder(params),
      tableFigureFormat: this.extractTableFigureFormat(params),
      restrictions: this.extractRestrictions(params),
      wizardData,
      coverConfig: {
        coverCount: 1,
        covers: [],
      },
      fixedPages: this.extractFixedPages(params),
      errors: [],
      warnings: [],
      infos: [],
    };
  }

  private extractPageLayout(params: Record<string, unknown>): PageLayoutSettings {
    const p = (params.pageLayout ?? {}) as Record<string, unknown>;
    return {
      paperSize: (p.paperSize as string) ?? defaultPageLayout.paperSize,
      orientation:
        (p.orientation as 'portrait' | 'landscape') ??
        defaultPageLayout.orientation,
      marginTopCm: (p.marginTopCm as number) ?? defaultPageLayout.marginTopCm,
      marginBottomCm:
        (p.marginBottomCm as number) ?? defaultPageLayout.marginBottomCm,
      marginLeftCm:
        (p.marginLeftCm as number) ?? defaultPageLayout.marginLeftCm,
      marginRightCm:
        (p.marginRightCm as number) ?? defaultPageLayout.marginRightCm,
      headerMarginCm:
        (p.headerMarginCm as number) ?? defaultPageLayout.headerMarginCm,
      footerMarginCm:
        (p.footerMarginCm as number) ?? defaultPageLayout.footerMarginCm,
      gutterCm: (p.gutterCm as number) ?? defaultPageLayout.gutterCm,
    };
  }

  private extractTypography(params: Record<string, unknown>): TypographySettings {
    const t = (params.typography ?? {}) as Record<string, unknown>;
    return {
      fontFamily: (t.fontFamily as string) ?? defaultTypography.fontFamily,
      fontSizePt: (t.fontSizePt as number) ?? defaultTypography.fontSizePt,
      lineSpacing: (t.lineSpacing as number) ?? defaultTypography.lineSpacing,
      paragraphSpacingBeforePt:
        (t.paragraphSpacingBeforePt as number) ??
        defaultTypography.paragraphSpacingBeforePt,
      paragraphSpacingAfterPt:
        (t.paragraphSpacingAfterPt as number) ??
        defaultTypography.paragraphSpacingAfterPt,
      alignment:
        (t.alignment as 'left' | 'center' | 'right' | 'justify') ??
        defaultTypography.alignment,
      firstLineIndentCm:
        (t.firstLineIndentCm as number) ?? defaultTypography.firstLineIndentCm,
      captionFontSizePt:
        (t.captionFontSizePt as number) ?? defaultTypography.captionFontSizePt,
      footnoteFontSizePt:
        (t.footnoteFontSizePt as number) ??
        defaultTypography.footnoteFontSizePt,
      tableContentFontSizePt:
        (t.tableContentFontSizePt as number) ??
        defaultTypography.tableContentFontSizePt,
      pageNumberFontSizePt:
        (t.pageNumberFontSizePt as number) ??
        defaultTypography.pageNumberFontSizePt,
    };
  }

  private extractHeadingStyles(
    params: Record<string, unknown>,
  ): HeadingStyleSettings {
    const h = (params.headingHierarchy ?? {}) as Record<string, unknown>;
    const levels =
      (h.levels as HeadingStyleLevel[]) ?? defaultHeadingLevels;
    return { levels };
  }

  private extractPageNumbering(
    params: Record<string, unknown>,
  ): PageNumberingSettings {
    const pn = (params.pageNumbering ?? {}) as Record<string, unknown>;

    if (pn.zones && Array.isArray(pn.zones)) {
      return {
        zones: pn.zones as PageNumberingSettings['zones'],
        unnumberedPages:
          (pn.unnumberedPages as number[]) ??
          defaultPageNumbering.unnumberedPages,
      };
    }

    // Legacy format compatibility (EditorPageNumberingSettings)
    const frontMatterStyle =
      (pn.frontMatterStyle as string) ?? 'roman';
    const bodyStartPage = (pn.bodyStartPage as number) ?? 1;
    const bodyStartNumber = (pn.bodyStartNumber as number) ?? 1;
    const bodyStyle = (pn.bodyStyle as string) ?? 'arabic';

    return {
      zones: [
        {
          id: 'frontMatter',
          startPage: 1,
          endPage: bodyStartPage - 1,
          style: frontMatterStyle === 'roman' ? 'roman' : 'arabic',
          startNumber: 1,
          position: 'bottom-center',
          fontFamily: defaultTypography.fontFamily,
          fontSizePt: defaultTypography.pageNumberFontSizePt ?? 12,
        },
        {
          id: 'body',
          startPage: bodyStartPage,
          endPage: null,
          style: bodyStyle === 'arabic' ? 'arabic' : 'roman',
          startNumber: bodyStartNumber,
          position: 'bottom-center',
          fontFamily: defaultTypography.fontFamily,
          fontSizePt: defaultTypography.pageNumberFontSizePt ?? 12,
        },
      ],
      unnumberedPages:
        (pn.unnumberedPages as number[]) ??
        defaultPageNumbering.unnumberedPages,
    };
  }

  private extractSequenceNumbering(
    params: Record<string, unknown>,
  ): SequenceNumberingSettings {
    const seq = (params.sequenceNumbering ?? params.sequence ?? {}) as Record<
      string,
      unknown
    >;
    return {
      mode:
        (seq.mode as 'sequential' | 'chapterBased') ??
        defaultSequenceNumbering.mode,
      tableStart:
        (seq.tableStart as number) ?? defaultSequenceNumbering.tableStart,
      figureStart:
        (seq.figureStart as number) ?? defaultSequenceNumbering.figureStart,
      equationStart:
        (seq.equationStart as number) ?? defaultSequenceNumbering.equationStart,
      chapterSeparator:
        (seq.chapterSeparator as string) ??
        defaultSequenceNumbering.chapterSeparator,
    };
  }

  private extractSectionOrder(
    params: Record<string, unknown>,
  ): SectionOrderSettings {
    const so = (params.sectionOrdering ?? {}) as Record<string, unknown>;
    const items = so.items as string[] | undefined;
    return {
      order: items ?? defaultSectionOrder.order,
    };
  }

  private extractTableFigureFormat(
    params: Record<string, unknown>,
  ): TableFigureFormatSettings {
    const tf = (params.tableFigureFormat ?? {}) as Record<string, unknown>;
    return {
      tableCaptionPosition:
        (tf.tableCaptionPosition as 'above' | 'below') ??
        defaultTableFigureFormat.tableCaptionPosition,
      figureCaptionPosition:
        (tf.figureCaptionPosition as 'above' | 'below') ??
        defaultTableFigureFormat.figureCaptionPosition,
      numberingSystem:
        (tf.numberingSystem as 'sequential' | 'chapterBased') ??
        defaultTableFigureFormat.numberingSystem,
      numberFormat:
        (tf.numberFormat as string) ?? defaultTableFigureFormat.numberFormat,
      captionIsBold:
        (tf.captionIsBold as boolean) ?? defaultTableFigureFormat.captionIsBold,
      captionSeparator:
        (tf.captionSeparator as string) ??
        defaultTableFigureFormat.captionSeparator,
      sourcePosition: 'below',
      continuationFormat:
        (tf.continuationFormat as string) ??
        defaultTableFigureFormat.continuationFormat,
      continuationRepeatHeaders:
        (tf.continuationRepeatHeaders as boolean) ??
        defaultTableFigureFormat.continuationRepeatHeaders,
      tableAlignment:
        (tf.tableAlignment as 'left' | 'center' | 'right') ??
        defaultTableFigureFormat.tableAlignment,
      tableBorderStyle:
        (tf.tableBorderStyle as 'full' | 'topBottom' | 'none') ??
        defaultTableFigureFormat.tableBorderStyle,
    };
  }

  private extractRestrictions(
    params: Record<string, unknown>,
  ): RestrictionSettings {
    const r = (params.restrictions ?? {}) as Record<string, unknown>;
    return {
      abstractWordLimitMin: r.abstractWordLimitMin as number | undefined,
      abstractWordLimitMax:
        (r.abstractWordLimitMax as number) ??
        defaultRestrictions.abstractWordLimitMax,
      mainTextWordLimitMin:
        (r.mainTextWordLimitMin as number) ??
        (r.minWordCount as number) ??
        undefined,
      mainTextWordLimitMax:
        (r.mainTextWordLimitMax as number) ??
        (r.maxWordCount as number) ??
        undefined,
      keywordCountMin:
        (r.keywordCountMin as number) ?? defaultRestrictions.keywordCountMin,
      keywordCountMax:
        (r.keywordCountMax as number) ?? defaultRestrictions.keywordCountMax,
    };
  }

  private extractFixedPages(
    params: Record<string, unknown>,
  ): FormattingPipelineContext['fixedPages'] {
    const fp = (params.fixedPages ?? {}) as Record<string, unknown>;
    return {
      approval: (fp.approval as boolean) ?? defaultFixedPages.approval,
      declaration: (fp.declaration as boolean) ?? defaultFixedPages.declaration,
      abstractTr: (fp.abstractTr as boolean) ?? defaultFixedPages.abstractTr,
      abstractEn: (fp.abstractEn as boolean) ?? defaultFixedPages.abstractEn,
      tableOfContents:
        (fp.tableOfContents as boolean) ?? defaultFixedPages.tableOfContents,
      tableList: (fp.tableList as boolean) ?? defaultFixedPages.tableList,
      figureList: (fp.figureList as boolean) ?? defaultFixedPages.figureList,
      abbreviations:
        (fp.abbreviations as boolean) ?? defaultFixedPages.abbreviations,
      cv: (fp.cv as boolean) ?? defaultFixedPages.cv,
    };
  }

  /**
   * Generate fixed pages (cover, approval, declaration, abstract, TOC, etc.)
   * based on template configuration and wizard data.
   */
  private generateFixedPages(
    ctx: FormattingPipelineContext,
    contentBlocks: FormattedBlock[],
  ): FormattedBlock[] {
    const pages: FormattedBlock[] = [];
    const wd = ctx.wizardData;
    const typo = ctx.typography;

    // Cover page(s)
    pages.push(
      ...this.coverPageGenerator.generateCoverPage({
        title: wd.cover?.title ?? '',
        author: wd.cover?.author ?? '',
        institution: wd.cover?.university ?? '',
        institute: wd.cover?.institute ?? '',
        department: wd.cover?.department ?? '',
        workType: wd.cover?.workType ?? '',
        advisor: wd.cover?.advisor ?? '',
        coAdvisor: wd.cover?.coAdvisor,
        city: wd.cover?.city ?? '',
        date: wd.cover?.date ?? '',
        fontFamily: typo.fontFamily,
        fontSizePt: typo.fontSizePt,
      }),
    );

    // Approval page
    if (ctx.fixedPages.approval && wd.approval) {
      pages.push(
        ...this.approvalPageGenerator.generateApprovalPage({
          ...wd.approval,
          fontFamily: typo.fontFamily,
          fontSizePt: typo.fontSizePt,
        }),
      );
    }

    // Declaration page
    if (ctx.fixedPages.declaration) {
      pages.push(
        ...this.declarationGenerator.generateDeclaration({
          text: wd.declaration?.text,
          showSignature: wd.declaration?.showSignature ?? true,
          fontFamily: typo.fontFamily,
          fontSizePt: typo.fontSizePt,
        }),
      );
    }

    // Abstract (TR)
    if (ctx.fixedPages.abstractTr && wd.abstractTr) {
      pages.push(
        ...this.abstractPageGenerator.generateAbstractPage({
          ...wd.abstractTr,
          language: 'tr',
          fontFamily: typo.fontFamily,
          fontSizePt: typo.fontSizePt,
        }),
      );
    }

    // Abstract (EN)
    if (ctx.fixedPages.abstractEn && wd.abstractEn) {
      pages.push(
        ...this.abstractPageGenerator.generateAbstractPage({
          ...wd.abstractEn,
          language: 'en',
          fontFamily: typo.fontFamily,
          fontSizePt: typo.fontSizePt,
        }),
      );
    }

    // Table of contents
    if (ctx.fixedPages.tableOfContents) {
      pages.push(
        ...this.tocGenerator.generateTableOfContents(
          contentBlocks,
          typo.fontFamily,
          typo.fontSizePt,
        ),
      );
    }

    // Table list
    if (ctx.fixedPages.tableList) {
      pages.push(
        ...this.tableListGenerator.generateTableList(
          contentBlocks,
          typo.fontFamily,
          typo.fontSizePt,
        ),
      );
    }

    // Figure list
    if (ctx.fixedPages.figureList) {
      pages.push(
        ...this.figureListGenerator.generateFigureList(
          contentBlocks,
          typo.fontFamily,
          typo.fontSizePt,
        ),
      );
    }

    // Abbreviations
    if (ctx.fixedPages.abbreviations && wd.abbreviations?.length) {
      pages.push(
        ...this.abbreviationsGenerator.generateAbbreviations(
          wd.abbreviations,
          typo.fontFamily,
          typo.fontSizePt,
        ),
      );
    }

    // CV
    if (ctx.fixedPages.cv && wd.cv) {
      pages.push(
        ...this.cvGenerator.generateCV(
          wd.cv,
          typo.fontFamily,
          typo.fontSizePt,
        ),
      );
    }

    // Re-index generated pages
    return pages.map((page, index) => ({
      ...page,
      orderIndex: index,
    }));
  }

  /**
   * Builds a chapter-number lookup for chapter-based sequence numbering.
   */
  private getCurrentChapterBlocks(
    blocks: FormattedBlock[],
  ): Map<number, number> {
    const chapterMap = new Map<number, number>();
    let currentChapter = 0;

    blocks.forEach((block, index) => {
      if (
        block.blockType === 'HEADING' &&
        block.metadata?.heading?.level === 1
      ) {
        currentChapter += 1;
      }
      chapterMap.set(index, currentChapter);
    });

    return chapterMap;
  }

  private buildResult(
    ctx: FormattingPipelineContext,
    blocks: FormattedBlock[],
    generatedPages: FormattedBlock[],
    startedAt: number,
  ): FormattingResult {
    return {
      success: ctx.errors.length === 0,
      errors: ctx.errors,
      warnings: ctx.warnings,
      infos: ctx.infos,
      formattedBlocks: blocks,
      generatedPages,
      documentId: ctx.documentId,
      documentVersionId: ctx.documentVersionId,
      durationMs: Date.now() - startedAt,
    };
  }
}
