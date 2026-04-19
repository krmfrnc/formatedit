import { Injectable } from '@nestjs/common';
import type {
  FormattedBlock,
  FormattingValidationError,
  RestrictionSettings,
} from './formatting.types';

@Injectable()
export class ValidationCheckerService {
  /**
   * Run comprehensive validation checks on formatted blocks.
   */
  runValidationChecks(
    blocks: FormattedBlock[],
    templateParameters: Record<string, unknown>,
    restrictions?: RestrictionSettings,
  ): FormattingValidationError[] {
    const issues: FormattingValidationError[] = [];

    issues.push(...this.checkMainTextWordCount(blocks, restrictions));
    issues.push(...this.checkAbstractWordCount(blocks, restrictions));
    issues.push(...this.checkNumberConsistency(blocks));
    issues.push(...this.checkMissingSections(blocks, templateParameters));
    issues.push(...this.checkHeadingNumberingConsistency(blocks));
    issues.push(...this.checkSectionOrder(blocks, templateParameters));
    issues.push(...this.checkCrossReferenceValidity(blocks));

    return issues;
  }

  /**
   * Check main text word count against restrictions.
   */
  private checkMainTextWordCount(
    blocks: FormattedBlock[],
    restrictions?: RestrictionSettings,
  ): FormattingValidationError[] {
    const issues: FormattingValidationError[] = [];
    const min = restrictions?.mainTextWordLimitMin;
    const max = restrictions?.mainTextWordLimitMax;

    if (min === undefined && max === undefined) {
      return issues;
    }

    // Count words from body blocks only (excluding generated pages)
    const bodyBlocks = blocks.filter(
      (b) => !this.isFrontMatterSlot(b.metadata?.templateSlot as string),
    );

    const totalWords = this.countWords(bodyBlocks);

    if (min !== undefined && totalWords < min) {
      issues.push({
        severity: 'WARNING',
        code: 'WORD_COUNT_BELOW_MINIMUM',
        message: `Belge ${totalWords} kelime içeriyor, minimum gerekli ${min}`,
      });
    }

    if (max !== undefined && totalWords > max) {
      issues.push({
        severity: 'ERROR',
        code: 'WORD_COUNT_EXCEEDS_MAXIMUM',
        message: `Belge ${totalWords} kelime içeriyor, maksimum izin verilen ${max}`,
      });
    }

    return issues;
  }

  /**
   * Check abstract word count against restrictions.
   */
  private checkAbstractWordCount(
    blocks: FormattedBlock[],
    restrictions?: RestrictionSettings,
  ): FormattingValidationError[] {
    const issues: FormattingValidationError[] = [];
    const min = restrictions?.abstractWordLimitMin;
    const max = restrictions?.abstractWordLimitMax;

    if (min === undefined && max === undefined) {
      return issues;
    }

    const abstractBlocks = blocks.filter(
      (b) =>
        (b.metadata?.templateSlot as string) === 'ABSTRACT_TR' ||
        (b.metadata?.templateSlot as string) === 'ABSTRACT_EN',
    );

    if (abstractBlocks.length === 0) {
      return issues;
    }

    const wordCount = this.countWords(
      abstractBlocks.filter((b) => b.blockType === 'PARAGRAPH'),
    );

    if (min !== undefined && wordCount < min) {
      issues.push({
        severity: 'WARNING',
        code: 'ABSTRACT_WORD_COUNT_BELOW_MINIMUM',
        message: `Özet ${wordCount} kelime içeriyor, minimum gerekli ${min}`,
        section: 'ABSTRACT',
      });
    }

    if (max !== undefined && wordCount > max) {
      issues.push({
        severity: 'ERROR',
        code: 'ABSTRACT_WORD_COUNT_EXCEEDS_MAXIMUM',
        message: `Özet ${wordCount} kelime içeriyor, maksimum izin verilen ${max}`,
        section: 'ABSTRACT',
      });
    }

    return issues;
  }

  /**
   * Check for duplicate or missing sequence numbers.
   */
  private checkNumberConsistency(
    blocks: FormattedBlock[],
  ): FormattingValidationError[] {
    const issues: FormattingValidationError[] = [];

    const tableNumbers: number[] = [];
    const figureNumbers: number[] = [];
    const equationNumbers: number[] = [];

    blocks.forEach((block, index) => {
      const seq = block.metadata?.sequence;
      if (!seq) {
        return;
      }

      const number = seq.sequenceNumber;
      const type = seq.sequenceType;

      const targetArray =
        type === 'table'
          ? tableNumbers
          : type === 'figure'
            ? figureNumbers
            : equationNumbers;

      if (targetArray.includes(number)) {
        issues.push({
          severity: 'ERROR',
          code: `DUPLICATE_${type.toUpperCase()}_NUMBER`,
          message: `Tekrarlanan ${this.getTypeLabel(type)} numarası: ${number}`,
          blockIndex: index,
        });
      } else {
        targetArray.push(number);
      }
    });

    this.checkSequenceGaps(issues, tableNumbers, 'table');
    this.checkSequenceGaps(issues, figureNumbers, 'figure');
    this.checkSequenceGaps(issues, equationNumbers, 'equation');

    return issues;
  }

  /**
   * Check for gaps in sequence numbering.
   */
  private checkSequenceGaps(
    issues: FormattingValidationError[],
    numbers: number[],
    type: string,
  ): void {
    if (numbers.length === 0) {
      return;
    }

    const sorted = [...numbers].sort((a, b) => a - b);
    const min = sorted[0];

    for (let i = min; i <= sorted[sorted.length - 1]; i++) {
      if (!sorted.includes(i)) {
        issues.push({
          severity: 'WARNING',
          code: 'SEQUENCE_GAP',
          message: `Eksik ${this.getTypeLabel(type)} numarası: ${i}`,
        });
      }
    }
  }

  /**
   * Check for missing required sections.
   */
  private checkMissingSections(
    blocks: FormattedBlock[],
    templateParameters: Record<string, unknown>,
  ): FormattingValidationError[] {
    const issues: FormattingValidationError[] = [];

    const fixedPages = (templateParameters.fixedPages ?? {}) as Record<
      string,
      unknown
    >;

    const requiredSections: string[] = [];

    if (fixedPages.abstractTr === true) requiredSections.push('ABSTRACT_TR');
    if (fixedPages.abstractEn === true) requiredSections.push('ABSTRACT_EN');
    if (fixedPages.declaration === true) requiredSections.push('DECLARATION');
    if (fixedPages.approval === true) requiredSections.push('APPROVAL');
    if (fixedPages.tableOfContents === true) requiredSections.push('TABLE_OF_CONTENTS');

    const sectionOrder = (templateParameters.sectionOrdering ?? {}) as Record<
      string,
      unknown
    >;
    const sectionItems = sectionOrder.items as string[] | undefined;
    if (sectionItems) {
      for (const item of sectionItems) {
        if (!requiredSections.includes(item.toUpperCase())) {
          requiredSections.push(item.toUpperCase());
        }
      }
    }

    const presentSections = new Set<string>();
    for (const block of blocks) {
      const slot = (block.metadata?.templateSlot as string) ?? '';
      if (slot) {
        presentSections.add(slot.toUpperCase());
      }
      const semantic =
        (block.metadata?.semanticSectionType as string) ?? '';
      if (semantic) {
        presentSections.add(semantic.toUpperCase());
      }
    }

    for (const section of requiredSections) {
      if (!presentSections.has(section)) {
        issues.push({
          severity: 'WARNING',
          code: 'MISSING_SECTION',
          message: `Gerekli bölüm bulunamadı: "${section}"`,
          section,
        });
      }
    }

    return issues;
  }

  /**
   * Check heading numbering consistency (no skipped levels).
   */
  private checkHeadingNumberingConsistency(
    blocks: FormattedBlock[],
  ): FormattingValidationError[] {
    const issues: FormattingValidationError[] = [];
    let lastLevel: number | null = null;

    blocks.forEach((block, index) => {
      if (block.blockType !== 'HEADING') {
        return;
      }

      const level = block.metadata?.heading?.level;
      if (level === undefined || level === null) {
        return;
      }

      if (lastLevel !== null && level > lastLevel + 1) {
        issues.push({
          severity: 'WARNING',
          code: 'HEADING_LEVEL_SKIP',
          message: `Başlık seviyesi ${lastLevel}'den ${level}'e atladı (sıralama bozuk)`,
          blockIndex: index,
        });
      }

      lastLevel = level;
    });

    return issues;
  }

  /**
   * Check section ordering matches the expected template order.
   */
  private checkSectionOrder(
    blocks: FormattedBlock[],
    templateParameters: Record<string, unknown>,
  ): FormattingValidationError[] {
    const issues: FormattingValidationError[] = [];

    const sectionOrder = (templateParameters.sectionOrdering ?? {}) as Record<
      string,
      unknown
    >;
    const expectedOrder = sectionOrder.items as string[] | undefined;

    if (!expectedOrder || expectedOrder.length === 0) {
      return issues;
    }

    const actualOrder: string[] = [];
    for (const block of blocks) {
      const slot = (block.metadata?.templateSlot as string)?.toUpperCase();
      if (slot && !actualOrder.includes(slot)) {
        actualOrder.push(slot);
      }
    }

    // Check if actual order respects expected order
    const normalizedExpected = expectedOrder.map((s) => s.toUpperCase());
    let expectedIdx = 0;

    for (const actual of actualOrder) {
      const foundIdx = normalizedExpected.indexOf(actual, expectedIdx);
      if (foundIdx === -1) {
        // Not in expected list — skip (might be custom section)
        continue;
      }
      if (foundIdx < expectedIdx) {
        issues.push({
          severity: 'WARNING',
          code: 'SECTION_OUT_OF_ORDER',
          message: `Bölüm "${actual}" beklenen sırada değil`,
        });
      }
      expectedIdx = foundIdx;
    }

    return issues;
  }

  /**
   * Check for broken cross-references.
   */
  private checkCrossReferenceValidity(
    blocks: FormattedBlock[],
  ): FormattingValidationError[] {
    const issues: FormattingValidationError[] = [];

    // Find unresolved structured markers
    blocks.forEach((block, index) => {
      const unresolvedPattern = /\[ref:(table|figure|equation):(\w+|@\d+)\]/gi;
      if (unresolvedPattern.test(block.text)) {
        issues.push({
          severity: 'WARNING',
          code: 'UNRESOLVED_CROSS_REFERENCE',
          message: `Çözülemeyen çapraz referans bulundu`,
          blockIndex: index,
        });
      }
    });

    return issues;
  }

  // ─── Helpers ────────────────────────

  private countWords(blocks: FormattedBlock[]): number {
    let total = 0;
    for (const block of blocks) {
      if (block.text && typeof block.text === 'string') {
        const trimmed = block.text.trim();
        if (trimmed) {
          total += trimmed.split(/\s+/).length;
        }
      }
    }
    return total;
  }

  private getTypeLabel(type: string): string {
    switch (type) {
      case 'table': return 'tablo';
      case 'figure': return 'şekil';
      case 'equation': return 'denklem';
      default: return type;
    }
  }

  private isFrontMatterSlot(slot: string | undefined): boolean {
    if (!slot) return false;
    const frontMatterSlots = [
      'COVER', 'APPROVAL', 'DECLARATION', 'ACKNOWLEDGMENT',
      'ABSTRACT_TR', 'ABSTRACT_EN',
      'TABLE_OF_CONTENTS', 'TABLE_LIST', 'FIGURE_LIST',
      'ABBREVIATIONS',
    ];
    return frontMatterSlots.includes(slot.toUpperCase());
  }
}
