import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import * as mammoth from 'mammoth';
import { load } from 'cheerio';
import { appLogger } from '../../common/logger';
import { PrismaService } from '../../prisma.service';
import { QueueService } from '../queue/queue.service';
import {
  citationApaPattern,
  citationNumericPattern,
  citationInlinePattern,
  citationSuperscriptPattern,
  defaultFontSize,
  defaultTemplateOrder,
  detectCitationStyle,
  equationPattern,
  equationLatexPattern,
  equationSymbolPattern,
  equationNumberPattern,
  figurePattern,
  figureCaptionPattern,
  fontSizeHeadingBoost,
  fontSizeHeadingThresholds,
  footnotePattern,
  footnoteSuperscriptPattern,
  footnoteTextPattern,
  headingPattern,
  maxParseBlockCount,
  semanticSectionRules,
  tablePattern,
  tableCaptionPattern,
} from './document-parser.constants';
import { DocxAiHeadingService } from './docx-ai-heading.service';
import { SectionMatcherService } from './section-matcher.service';
import type {
  CitationInfo,
  ConfidenceScoreResponse,
  EquationInfo,
  FootnoteInfo,
  OutlineNode,
  ParseDiagnosticsResponse,
  ParseMetricsResponse,
  ParseResultResponse,
  ParseSummary,
  ParsedBlock,
  ParsedRun,
  SemanticSectionType,
} from './document-parser.types';

@Injectable()
export class DocumentParserService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly queueService: QueueService,
    private readonly docxAiHeadingService: DocxAiHeadingService,
    private readonly sectionMatcherService: SectionMatcherService,
  ) {}

  async parseAndPersist(
    documentId: string,
    documentVersionId: string,
    buffer: Buffer,
    requestedBy: string,
  ): Promise<ParseSummary> {
    const startedAt = Date.now();

    try {
      await this.prismaService.document.update({
        where: { id: documentId },
        data: {
          processingProgress: 70,
        },
      });

      const blocks = await this.parseDocxBuffer(buffer);
      const aiRefinedBlocks =
        this.docxAiHeadingService.refineHeadingConfidences(blocks);

      await this.persistBlocks(documentId, documentVersionId, aiRefinedBlocks);

      const summary = this.buildSummary(
        documentId,
        documentVersionId,
        aiRefinedBlocks,
        Date.now() - startedAt,
        this.docxAiHeadingService.isEnabled(),
      );

      await this.prismaService.documentVersion.update({
        where: { id: documentVersionId },
        data: {
          metadata: {
            parseSummary: summary,
            parseStatus: 'COMPLETED',
            parseAttempts: 0,
            lastQueuedAt: null,
            lastFailure: null,
          } as unknown as Prisma.InputJsonValue,
        },
      });

      await this.prismaService.document.update({
        where: { id: documentId },
        data: {
          processingProgress: 100,
        },
      });

      appLogger.info('DOCX parse completed', {
        documentId,
        documentVersionId,
        durationMs: summary.durationMs,
        totalBlocks: summary.totalBlocks,
        headingCount: summary.headingCount,
        averageConfidence: summary.averageConfidence,
      });

      return summary;
    } catch (error) {
      const durationMs = Date.now() - startedAt;
      appLogger.error('DOCX parse failed', {
        documentId,
        documentVersionId,
        durationMs,
        error: error instanceof Error ? error.message : 'Unknown parse error',
      });

      await this.prismaService.documentVersion.update({
        where: { id: documentVersionId },
        data: {
          metadata: {
            parseStatus: 'FAILED',
            error:
              error instanceof Error ? error.message : 'Unknown parse error',
            lastFailure:
              error instanceof Error ? error.message : 'Unknown parse error',
          } as Prisma.InputJsonValue,
        },
      });

      const queuedJob = await this.queueService.enqueueParseJob({
        documentId,
        documentVersionId,
        requestedBy,
        stage: 'parse',
      });

      await this.prismaService.documentVersion.update({
        where: { id: documentVersionId },
        data: {
          metadata: {
            parseStatus: 'QUEUED',
            lastFailure:
              error instanceof Error ? error.message : 'Unknown parse error',
            lastQueuedAt: new Date().toISOString(),
            parseAttempts: queuedJob.attemptsMade ?? 0,
          } as Prisma.InputJsonValue,
        },
      });

      throw new InternalServerErrorException(
        'Document parse failed and has been queued for retry',
      );
    }
  }

  async queueParseRetry(
    userId: string,
    documentId: string,
  ): Promise<{ queued: true }> {
    const document = await this.prismaService.document.findFirst({
      where: { id: documentId, userId, deletedAt: null },
      include: {
        versions: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!document) {
      throw new NotFoundException('Document was not found');
    }

    const targetVersion =
      document.versions.find((version) => version.type === 'RAW') ??
      document.versions[0] ??
      null;

    if (!targetVersion) {
      throw new NotFoundException('Document version was not found');
    }

    await this.queueService.enqueueParseJob({
      documentId,
      documentVersionId: targetVersion.id,
      requestedBy: userId,
      storageKey: targetVersion.storageKey ?? undefined,
      stage: 'parse',
    });

    await this.prismaService.documentVersion.update({
      where: { id: targetVersion.id },
      data: {
        metadata: {
          parseStatus: 'QUEUED',
          lastQueuedAt: new Date().toISOString(),
          parseAttempts:
            Number(
              ((targetVersion.metadata ?? {}) as Record<string, unknown>)
                .parseAttempts ?? 0,
            ) + 1,
        } as Prisma.InputJsonValue,
      },
    });

    return { queued: true };
  }

  async queuePdfConversion(
    userId: string,
    documentId: string,
    documentVersionId: string,
  ): Promise<{ queued: true; lowConfidence: true }> {
    await this.queueService.enqueuePdfConversionJob({
      documentId,
      documentVersionId,
      requestedBy: userId,
      stage: 'pdf-convert',
    });

    await this.prismaService.documentVersion.update({
      where: { id: documentVersionId },
      data: {
        metadata: {
          parseSource: 'pdf-conversion',
          lowConfidence: true,
          conversionStatus: 'QUEUED',
          lastQueuedAt: new Date().toISOString(),
        } as Prisma.InputJsonValue,
      },
    });

    return { queued: true, lowConfidence: true };
  }

  async getParseResultForUser(
    userId: string,
    documentId: string,
  ): Promise<ParseResultResponse> {
    const { documentVersionId, blocks, aiAssisted } =
      await this.getBlocksForUser(userId, documentId);

    return {
      summary: this.buildSummary(
        documentId,
        documentVersionId,
        blocks,
        0,
        aiAssisted,
      ),
      blocks,
    };
  }

  async getOutlineForUser(
    userId: string,
    documentId: string,
  ): Promise<OutlineNode[]> {
    const { blocks } = await this.getBlocksForUser(userId, documentId);
    const headings = blocks
      .filter(
        (block) =>
          block.blockType === 'HEADING' && typeof block.level === 'number',
      )
      .sort((left, right) => left.orderIndex - right.orderIndex);

    const root: OutlineNode[] = [];
    const stack: OutlineNode[] = [];

    for (const heading of headings) {
      const node: OutlineNode = {
        title: heading.title ?? heading.text,
        level: heading.level ?? 1,
        orderIndex: heading.orderIndex,
        confidenceScore: heading.confidenceScore,
        children: [],
      };

      while (stack.length && stack[stack.length - 1].level >= node.level) {
        stack.pop();
      }

      if (!stack.length) {
        root.push(node);
      } else {
        stack[stack.length - 1].children.push(node);
      }

      stack.push(node);
    }

    return root;
  }

  async getConfidenceForUser(
    userId: string,
    documentId: string,
  ): Promise<ConfidenceScoreResponse> {
    const { documentVersionId, blocks, aiAssisted } =
      await this.getBlocksForUser(userId, documentId);

    const headingBlocks = blocks.filter(
      (block) => block.blockType === 'HEADING',
    );
    const averageConfidence = this.average(
      blocks.map((block) => block.confidenceScore),
    );
    const headingAverageConfidence = this.average(
      headingBlocks.map((block) => block.confidenceScore),
    );

    return {
      documentId,
      documentVersionId,
      averageConfidence,
      headingAverageConfidence,
      blockCount: blocks.length,
      lowConfidence: averageConfidence < 0.55,
      aiAssisted,
    };
  }

  async getDiagnosticsForUser(
    userId: string,
    documentId: string,
  ): Promise<ParseDiagnosticsResponse> {
    const { documentVersionId, blocks, aiAssisted, parseSource } =
      await this.getBlocksForUser(userId, documentId);

    const blockTypeCounts = blocks.reduce<
      Record<ParsedBlock['blockType'], number>
    >(
      (accumulator, block) => {
        accumulator[block.blockType] += 1;
        return accumulator;
      },
      {
        HEADING: 0,
        PARAGRAPH: 0,
        TABLE: 0,
        FIGURE: 0,
        EQUATION: 0,
        FOOTNOTE: 0,
        CITATION: 0,
        TABLE_CAPTION: 0,
        FIGURE_CAPTION: 0,
      },
    );

    const semanticSectionCounts = blocks.reduce<
      Record<SemanticSectionType, number>
    >(
      (accumulator, block) => {
        if (accumulator[block.semanticSectionType] !== undefined) {
          accumulator[block.semanticSectionType] += 1;
        }
        return accumulator;
      },
      {
        ABSTRACT: 0,
        INTRODUCTION: 0,
        LITERATURE_REVIEW: 0,
        METHODS: 0,
        RESULTS: 0,
        DISCUSSION: 0,
        CONCLUSION: 0,
        REFERENCES: 0,
        APPENDIX: 0,
        ACKNOWLEDGMENT: 0,
        ABBREVIATIONS: 0,
        TABLE_OF_CONTENTS: 0,
        TABLE_LIST: 0,
        FIGURE_LIST: 0,
        CV: 0,
        DECLARATION: 0,
        BODY: 0,
      },
    );

    return {
      documentId,
      documentVersionId,
      blockTypeCounts,
      semanticSectionCounts,
      templateSlots: this.getTemplateSlots(),
      lowConfidenceBlocks: blocks
        .filter((block) => block.confidenceScore < 0.55)
        .map((block) => ({
          orderIndex: block.orderIndex,
          title: block.title,
          blockType: block.blockType,
          confidenceScore: block.confidenceScore,
        })),
      parseSource,
      aiAssisted,
    };
  }

  async getMetricsForUser(
    userId: string,
    documentId: string,
  ): Promise<ParseMetricsResponse> {
    const { documentVersionId, blocks, aiAssisted, parseSource } =
      await this.getBlocksForUser(userId, documentId);

    const version = await this.prismaService.documentVersion.findUnique({
      where: { id: documentVersionId },
    });

    const metadata = (version?.metadata ?? {}) as Record<string, unknown>;
    const summary = (metadata.parseSummary ?? {}) as Record<string, unknown>;
    const queue =
      await this.queueService.getDocumentPipelineSnapshot(documentId);

    return {
      documentId,
      documentVersionId,
      durationMs: Number(summary.durationMs ?? 0),
      totalBlocks: blocks.length,
      averageConfidence: this.average(
        blocks.map((block) => block.confidenceScore),
      ),
      averageRunsPerBlock: this.average(
        blocks.map((block) =>
          'runs' in block && Array.isArray(block.runs) ? block.runs.length : 0,
        ),
      ),
      headingCount: blocks.filter((block) => block.blockType === 'HEADING')
        .length,
      lowConfidenceBlockCount: blocks.filter(
        (block) => block.confidenceScore < 0.55,
      ).length,
      truncated: blocks.length >= maxParseBlockCount,
      aiAssisted,
      parseSource,
      queue: {
        parsePending: queue.parsePending,
        parseRetryAttempts: Number(metadata.parseAttempts ?? 0),
        pdfConversionPending: queue.pdfConversionPending,
        lastQueuedAt:
          typeof metadata.lastQueuedAt === 'string'
            ? metadata.lastQueuedAt
            : null,
        lastFailure:
          typeof metadata.lastFailure === 'string'
            ? metadata.lastFailure
            : null,
      },
    };
  }

  async queuePdfConversionForUser(
    userId: string,
    documentId: string,
    documentVersionId: string,
  ): Promise<{ queued: true; lowConfidence: true }> {
    const document = await this.prismaService.document.findFirst({
      where: { id: documentId, userId, deletedAt: null },
      include: {
        versions: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!document) {
      throw new NotFoundException('Document was not found');
    }

    const version = document.versions.find(
      (entry) => entry.id === documentVersionId,
    );
    if (!version) {
      throw new NotFoundException('Document version was not found');
    }

    return this.queuePdfConversion(userId, documentId, documentVersionId);
  }

  async parseDocxBuffer(buffer: Buffer): Promise<ParsedBlock[]> {
    const htmlResult = await mammoth.convertToHtml({ buffer });
    const rawHtml = htmlResult.value || '';
    return this.parseDocxHtml(rawHtml);
  }

  parseDocxHtml(rawHtml: string): ParsedBlock[] {
    const $ = load(rawHtml);
    const blocks: ParsedBlock[] = [];
    let orderIndex = 0;

    $('h1, h2, h3, h4, h5, p, table, li').each((_, element) => {
      if (blocks.length >= maxParseBlockCount) {
        return;
      }

      const node = $(element);
      const tagName = element.tagName?.toLowerCase() ?? 'p';
      const text = node.text().replace(/\s+/g, ' ').trim();
      if (!text && tagName !== 'table') {
        return;
      }

      const runs = this.extractRuns(node, tagName);
      const lineLengthScore = this.calculateLineLengthScore(text);
      const numberingPattern = this.extractNumberingPattern(text);
      const sectionMatch = this.resolveSemanticSection(text);

      // Enhanced detection
      const citations = this.extractCitations(text);
      const equations = this.extractEquations(text);
      const footnotes = this.extractFootnotes(text, runs);

      const hasCitation = citations.length > 0;
      const hasFootnote = footnotes.length > 0;
      const hasEquation = equations.length > 0;
      const tableMatch = text.match(tablePattern);
      const figureMatch = text.match(figurePattern);

      const headingLevel = this.detectHeadingLevel({
        tagName,
        text,
        runs,
        numberingPattern,
      });

      const blockType = this.resolveBlockType({
        tagName,
        headingLevel,
        text,
        hasCitation,
        hasFootnote,
        hasEquation,
        hasTableLabel: Boolean(tableMatch),
        hasFigureLabel: Boolean(figureMatch),
      });

      const confidenceScore = this.calculateConfidenceScore({
        tagName,
        blockType,
        headingLevel,
        text,
        numberingPattern,
        lineLengthScore,
        semanticMatched: Boolean(sectionMatch),
        runs,
      });

      // Extract caption text for table/figure captions
      let captionText: string | undefined;
      if (blockType === 'TABLE' && tableCaptionPattern.test(text)) {
        captionText = text.replace(tableCaptionPattern, '').trim();
      } else if (blockType === 'FIGURE' && figureCaptionPattern.test(text)) {
        captionText = text.replace(figureCaptionPattern, '').trim();
      }

      blocks.push({
        orderIndex: orderIndex++,
        blockType,
        semanticSectionType: (sectionMatch?.type ??
          'BODY') as SemanticSectionType,
        title: blockType === 'HEADING' ? text : null,
        text,
        level: headingLevel,
        confidenceScore,
        numberingPattern,
        lineLengthScore,
        hasCitation,
        hasFootnote,
        hasEquation,
        tableOrFigureLabel: tableMatch?.[0] ?? figureMatch?.[0] ?? null,
        templateSlot: sectionMatch?.templateSlot ?? null,
        runs,
        numberingOverride: null,
        manualSequenceNumber: null,
        citations: citations.length > 0 ? citations : undefined,
        equations: equations.length > 0 ? equations : undefined,
        footnotes: footnotes.length > 0 ? footnotes : undefined,
        captionText,
      });
    });

    return blocks;
  }

  private async getBlocksForUser(
    userId: string,
    documentId: string,
  ): Promise<{
    documentVersionId: string;
    blocks: ParsedBlock[];
    aiAssisted: boolean;
    parseSource: 'docx' | 'pdf-conversion';
  }> {
    const document = await this.prismaService.document.findFirst({
      where: { id: documentId, userId, deletedAt: null },
    });

    if (!document) {
      throw new NotFoundException('Document was not found');
    }

    const sections = await this.prismaService.documentSection.findMany({
      where: { documentId },
      orderBy: [{ orderIndex: 'asc' }, { createdAt: 'asc' }],
    });

    if (!sections.length) {
      throw new NotFoundException('Parse result is not available yet');
    }

    const documentVersionId = sections.find(
      (section) => section.documentVersionId,
    )?.documentVersionId;
    if (!documentVersionId) {
      throw new NotFoundException('Parsed document version was not found');
    }

    const version = await this.prismaService.documentVersion.findUnique({
      where: { id: documentVersionId },
    });

    const metadata = (version?.metadata ?? {}) as Record<string, unknown>;
    const summary = metadata.parseSummary as
      | Record<string, unknown>
      | undefined;

    return {
      documentVersionId,
      aiAssisted: Boolean(summary?.aiAssisted),
      parseSource:
        summary?.parseSource === 'pdf-conversion' ? 'pdf-conversion' : 'docx',
      blocks: sections.map((section) => {
        const content = (section.content ?? {}) as Record<string, unknown>;
        return {
          orderIndex: section.orderIndex,
          blockType: section.sectionType as ParsedBlock['blockType'],
          semanticSectionType:
            (content.semanticSectionType as SemanticSectionType | undefined) ??
            'BODY',
          title: section.title,
          text: (content.text as string | undefined) ?? '',
          level: section.level,
          confidenceScore: section.confidenceScore ?? 0,
          numberingPattern:
            (content.numberingPattern as string | undefined) ?? null,
          lineLengthScore: Number(content.lineLengthScore ?? 0),
          hasCitation: Boolean(content.hasCitation),
          hasFootnote: Boolean(content.hasFootnote),
          hasEquation: Boolean(content.hasEquation),
          tableOrFigureLabel:
            (content.tableOrFigureLabel as string | undefined) ?? null,
          templateSlot: (content.templateSlot as string | undefined) ?? null,
          runs: (content.runs as ParsedRun[] | undefined) ?? [],
          numberingOverride: null,
          manualSequenceNumber: null,
        };
      }),
    };
  }

  private async persistBlocks(
    documentId: string,
    documentVersionId: string,
    blocks: ParsedBlock[],
  ): Promise<void> {
    await this.prismaService.documentSection.deleteMany({
      where: {
        documentId,
        documentVersionId,
      },
    });

    await this.prismaService.documentSection.createMany({
      data: blocks.map((block) => ({
        documentId,
        documentVersionId,
        sectionType: block.blockType,
        title: block.title,
        orderIndex: block.orderIndex,
        level: block.level,
        confidenceScore: block.confidenceScore,
        content: {
          text: block.text,
          semanticSectionType: block.semanticSectionType,
          numberingPattern: block.numberingPattern,
          lineLengthScore: block.lineLengthScore,
          hasCitation: block.hasCitation,
          hasFootnote: block.hasFootnote,
          hasEquation: block.hasEquation,
          tableOrFigureLabel: block.tableOrFigureLabel,
          templateSlot: block.templateSlot,
          runs: block.runs,
        } as unknown as Prisma.InputJsonValue,
      })),
    });
  }

  private buildSummary(
    documentId: string,
    documentVersionId: string,
    blocks: ParsedBlock[],
    durationMs: number,
    aiAssisted: boolean,
  ): ParseSummary {
    const headingCount = blocks.filter(
      (block) => block.blockType === 'HEADING',
    ).length;
    const tableCount = blocks.filter(
      (block) => block.blockType === 'TABLE',
    ).length;
    const figureCount = blocks.filter(
      (block) => block.blockType === 'FIGURE',
    ).length;
    const equationCount = blocks.filter(
      (block) => block.blockType === 'EQUATION',
    ).length;
    const footnoteCount = blocks.filter((block) => block.hasFootnote).length;
    const citationCount = blocks.filter((block) => block.hasCitation).length;
    const averageConfidence = this.average(
      blocks.map((block) => block.confidenceScore),
    );

    return {
      documentId,
      documentVersionId,
      durationMs,
      totalBlocks: blocks.length,
      headingCount,
      tableCount,
      figureCount,
      equationCount,
      footnoteCount,
      citationCount,
      averageConfidence,
      lowConfidence: averageConfidence < 0.55,
      aiAssisted,
      parseSource: 'docx',
      averageRunsPerBlock: this.average(
        blocks.map((block) => block.runs.length),
      ),
      lowConfidenceBlockCount: blocks.filter(
        (block) => block.confidenceScore < 0.55,
      ).length,
      truncated: blocks.length >= maxParseBlockCount,
      citationStyle: detectCitationStyle(
        blocks.map((block) => block.text).join(' '),
      ),
    };
  }

  private detectHeadingLevel(input: {
    tagName: string;
    text: string;
    runs: ParsedRun[];
    numberingPattern: string | null;
  }): number | null {
    const tagHeading = input.tagName.match(/^h([1-5])$/);
    if (tagHeading) {
      return Number(tagHeading[1]);
    }

    const normalizedLength = input.text.length;
    const boldRatio = this.calculateBoldRatio(input.runs);
    const isShortLine = normalizedLength <= 120;
    const looksEnumerated = Boolean(input.numberingPattern);

    // When a numbering pattern is present on a short line that also looks
    // like a heading (bold or enumerated), the dot-count gives us a precise
    // level (`2.1` → 2, `1.2.3` → 3). This MUST take precedence over the
    // font-size heuristic, which is only a coarse fallback. Historically the
    // font-size branch ran first and short-circuited bold runs to level 4
    // because `extractRuns` tags bold paragraphs with an estimated size of
    // 12pt — defeating numbering-based detection. See F1b in the fix log.
    if (isShortLine && looksEnumerated && boldRatio >= 0.45) {
      const dotCount = (input.numberingPattern?.match(/\./g) ?? []).length;
      return Math.min(5, Math.max(1, dotCount + 1));
    }

    const maxFontSize = this.calculateMaxFontSize(input.runs);
    const fontSizeLevel = this.detectHeadingLevelFromFontSize(maxFontSize);

    if (fontSizeLevel) {
      return fontSizeLevel;
    }

    if (isShortLine && (boldRatio >= 0.45 || looksEnumerated)) {
      const dotCount = (input.numberingPattern?.match(/\./g) ?? []).length;
      return Math.min(5, Math.max(1, dotCount + 1));
    }

    return null;
  }

  private detectHeadingLevelFromFontSize(fontSize: number): number | null {
    const sortedLevels = Object.entries(fontSizeHeadingThresholds)
      .map(([level, threshold]) => ({ level: Number(level), threshold }))
      .sort((a, b) => b.threshold - a.threshold);

    for (const { level, threshold } of sortedLevels) {
      if (fontSize >= threshold) {
        return level;
      }
    }

    return null;
  }

  private resolveBlockType(input: {
    tagName: string;
    headingLevel: number | null;
    text: string;
    hasCitation: boolean;
    hasFootnote: boolean;
    hasEquation: boolean;
    hasTableLabel: boolean;
    hasFigureLabel: boolean;
  }): ParsedBlock['blockType'] {
    if (input.tagName === 'table' || input.hasTableLabel) {
      return 'TABLE';
    }

    if (input.hasFigureLabel) {
      return 'FIGURE';
    }

    if (input.headingLevel) {
      return 'HEADING';
    }

    if (input.hasEquation && input.text.length <= 180) {
      return 'EQUATION';
    }

    if (input.hasFootnote && input.text.length <= 80) {
      return 'FOOTNOTE';
    }

    if (input.hasCitation && input.text.length <= 200) {
      return 'CITATION';
    }

    return 'PARAGRAPH';
  }

  private resolveSemanticSection(
    text: string,
  ): { type: string; templateSlot: string } | null {
    const normalized = text.trim().toLowerCase();
    for (const rule of semanticSectionRules) {
      if (rule.pattern.test(normalized)) {
        return rule;
      }
    }

    return null;
  }

  private calculateConfidenceScore(input: {
    tagName: string;
    blockType: ParsedBlock['blockType'];
    headingLevel: number | null;
    text: string;
    numberingPattern: string | null;
    lineLengthScore: number;
    semanticMatched: boolean;
    runs: ParsedRun[];
  }): number {
    if (input.blockType === 'TABLE' || input.blockType === 'FIGURE') {
      return 0.88;
    }

    let score = 0.15;

    if (input.tagName.match(/^h[1-5]$/)) {
      score += 0.45;
    }

    if (input.headingLevel) {
      score += 0.1;
    }

    if (input.numberingPattern) {
      score += 0.16;
    }

    const boldRatio = this.calculateBoldRatio(input.runs);
    score += Math.min(0.14, boldRatio * 0.14);

    const maxFontSize = this.calculateMaxFontSize(input.runs);
    if (maxFontSize > defaultFontSize) {
      const boostRatio = Math.min(1, (maxFontSize - defaultFontSize) / 6);
      score += fontSizeHeadingBoost * boostRatio;
    }

    score += input.lineLengthScore * 0.1;

    if (input.semanticMatched) {
      score += 0.05;
    }

    if (input.text.length <= 4) {
      score -= 0.2;
    }

    return Number(Math.max(0.05, Math.min(0.99, score)).toFixed(3));
  }

  private extractRuns(
    node: {
      text: () => string;
      find: (selector: string) => { text: () => string; length?: number };
    },
    tagName: string,
  ): ParsedRun[] {
    if (tagName === 'table') {
      const tableText = node.text().replace(/\s+/g, ' ').trim();
      return tableText
        ? [
            {
              text: tableText,
              isBold: false,
              isItalic: false,
              isSuperscript: false,
              estimatedFontSize: 11,
            },
          ]
        : [];
    }

    const fullText = node.text().replace(/\s+/g, ' ').trim();
    const boldText = node.find('strong, b').text().replace(/\s+/g, ' ').trim();
    const italicText = node.find('em, i').text().replace(/\s+/g, ' ').trim();
    const supText = node.find('sup').text().replace(/\s+/g, ' ').trim();

    if (!fullText) {
      return [];
    }

    const isBold = boldText.length / Math.max(fullText.length, 1) >= 0.4;
    const isItalic = italicText.length / Math.max(fullText.length, 1) >= 0.4;
    const isSuperscript = supText.length > 0;

    if (!boldText && !italicText) {
      return [
        {
          text: fullText,
          isBold: false,
          isItalic: false,
          isSuperscript,
          estimatedFontSize: 11,
        },
      ];
    }

    return [
      {
        text: fullText,
        isBold,
        isItalic,
        isSuperscript,
        estimatedFontSize: isBold ? 12 : 11,
      },
    ];
  }

  // ─── Enhanced Detection Methods ─────────────────────────────────

  /**
   * Extract all citation references from text with style identification.
   */
  private extractCitations(text: string): CitationInfo[] {
    const citations: CitationInfo[] = [];

    // IEEE / numeric: [1], [1-3], [1,2,3]
    const numericRegex = new RegExp(citationNumericPattern.source, 'g');
    let match: RegExpExecArray | null;
    while ((match = numericRegex.exec(text)) !== null) {
      const nums = match[0]
        .replace(/[\[\]]/g, '')
        .split(/[,;\s]+/)
        .map((n) => parseInt(n, 10))
        .filter((n) => !isNaN(n));
      citations.push({
        raw: match[0],
        style: 'ieee',
        numbers: nums,
      });
    }

    // APA: (Author, 2024)
    const apaRegex = new RegExp(citationApaPattern.source, 'g');
    while ((match = apaRegex.exec(text)) !== null) {
      const yearMatch = match[0].match(/(19|20)\d{2}[a-z]?/);
      const authorPart = match[0].replace(/\(|\)/g, '').split(',')[0]?.trim();
      citations.push({
        raw: match[0],
        style: 'apa',
        authors: authorPart ? [authorPart] : undefined,
        year: yearMatch ? yearMatch[0] : undefined,
      });
    }

    // Inline: Author (2024)
    const inlineRegex = new RegExp(citationInlinePattern.source, 'g');
    while ((match = inlineRegex.exec(text)) !== null) {
      const yearMatch = match[0].match(/(19|20)\d{2}[a-z]?/);
      const authorPart = match[0].split('(')[0]?.trim();
      citations.push({
        raw: match[0],
        style: 'inline',
        authors: authorPart ? [authorPart] : undefined,
        year: yearMatch ? yearMatch[0] : undefined,
      });
    }

    // Superscript markers
    const supRegex = new RegExp(citationSuperscriptPattern.source, 'g');
    while ((match = supRegex.exec(text)) !== null) {
      citations.push({
        raw: match[0],
        style: 'vancouver',
      });
    }

    return citations;
  }

  /**
   * Extract all equation markers from text.
   */
  private extractEquations(text: string): EquationInfo[] {
    const equations: EquationInfo[] = [];

    // LaTeX patterns
    if (this.matchesPattern(equationLatexPattern, text)) {
      const latexMatch = text.match(equationLatexPattern);
      if (latexMatch) {
        const numMatch = text.match(equationNumberPattern);
        equations.push({
          raw: latexMatch[0],
          source: 'latex',
          equationNumber: numMatch ? numMatch[0].replace(/[()]/g, '') : undefined,
        });
      }
    }

    // Mathematical Unicode symbols
    if (this.matchesPattern(equationSymbolPattern, text)) {
      const symbolMatch = text.match(equationSymbolPattern);
      if (symbolMatch) {
        const numMatch = text.match(equationNumberPattern);
        equations.push({
          raw: symbolMatch[0],
          source: 'symbol',
          equationNumber: numMatch ? numMatch[0].replace(/[()]/g, '') : undefined,
        });
      }
    }

    // Keyword-based (basic operator/function names)
    if (equations.length === 0 && this.matchesPattern(equationPattern, text)) {
      // Only use keyword detection as fallback if no stronger signals found
      if (text.length <= 180) {
        const numMatch = text.match(equationNumberPattern);
        equations.push({
          raw: text,
          source: 'keyword',
          equationNumber: numMatch ? numMatch[0].replace(/[()]/g, '') : undefined,
        });
      }
    }

    return equations;
  }

  /**
   * Extract footnote markers from text and runs.
   */
  private extractFootnotes(text: string, runs: ParsedRun[]): FootnoteInfo[] {
    const footnotes: FootnoteInfo[] = [];

    // Superscript runs that look like footnote markers
    for (const run of runs) {
      if (run.isSuperscript) {
        const numMatch = run.text.match(/\d+/);
        if (numMatch) {
          footnotes.push({
            marker: run.text,
            source: 'superscript',
            number: parseInt(numMatch[0], 10),
          });
        }
      }
    }

    // Unicode superscript characters
    if (this.matchesPattern(footnoteSuperscriptPattern, text)) {
      const supMatch = text.match(footnoteSuperscriptPattern);
      if (supMatch && !footnotes.some((f) => f.marker === supMatch[0])) {
        footnotes.push({
          marker: supMatch[0],
          source: 'superscript',
        });
      }
    }

    // Bracket markers: [1], [2]
    if (this.matchesPattern(footnotePattern, text)) {
      const bracketMatch = text.match(/\[(\d+)\]/);
      if (bracketMatch && !footnotes.some((f) => f.number === parseInt(bracketMatch[1], 10))) {
        footnotes.push({
          marker: bracketMatch[0],
          source: 'bracket',
          number: parseInt(bracketMatch[1], 10),
        });
      }
    }

    // Footnote text pattern (paragraph starting with number)
    if (this.matchesPattern(footnoteTextPattern, text)) {
      const numMatch = text.match(/^\s*(\d+)/);
      if (numMatch) {
        footnotes.push({
          marker: numMatch[1],
          source: 'text',
          number: parseInt(numMatch[1], 10),
        });
      }
    }

    return footnotes;
  }

  private extractNumberingPattern(text: string): string | null {
    const match = text.match(headingPattern);
    if (!match?.[1]) {
      return null;
    }
    // The capture may include a trailing dot (arabic `1.`, roman `IV.`,
    // alpha `A.`). Normalize by stripping it so downstream dot-count logic
    // reflects hierarchy depth only (`1.2` → 1 dot = level 2, not 2 dots).
    return match[1].replace(/\.$/, '');
  }

  private calculateLineLengthScore(text: string): number {
    if (!text.length) {
      return 0;
    }

    if (text.length <= 120) {
      return 1;
    }

    if (text.length <= 220) {
      return 0.65;
    }

    return 0.35;
  }

  private calculateBoldRatio(runs: ParsedRun[]): number {
    if (!runs.length) {
      return 0;
    }

    const boldChars = runs
      .filter((run) => run.isBold)
      .reduce((total, run) => total + run.text.length, 0);
    const totalChars = runs.reduce((total, run) => total + run.text.length, 0);

    if (!totalChars) {
      return 0;
    }

    return boldChars / totalChars;
  }

  private average(values: number[]): number {
    if (!values.length) {
      return 0;
    }

    const total = values.reduce((sum, value) => sum + value, 0);
    return Number((total / values.length).toFixed(3));
  }

  getTemplateSlots(): string[] {
    return defaultTemplateOrder;
  }

  async getSectionMatchingForDocument(
    userId: string,
    documentId: string,
    templateId?: string,
    workType?: string,
  ) {
    const { blocks } = await this.getBlocksForUser(userId, documentId);

    const detectedSections = blocks.map((block) => ({
      sectionType: block.semanticSectionType,
      templateSlot: block.templateSlot,
    }));

    return this.sectionMatcherService.matchSectionsAgainstTemplate(
      detectedSections,
      templateId,
      workType,
    );
  }

  private calculateMaxFontSize(runs: ParsedRun[]): number {
    if (!runs.length) {
      return defaultFontSize;
    }

    let max = runs[0].estimatedFontSize;
    for (let i = 1; i < runs.length; i += 1) {
      if (runs[i].estimatedFontSize > max) {
        max = runs[i].estimatedFontSize;
      }
    }
    return max;
  }

  private matchesPattern(pattern: RegExp, text: string): boolean {
    const flags = pattern.flags.replace(/g/g, '');
    return new RegExp(pattern.source, flags).test(text);
  }
}
