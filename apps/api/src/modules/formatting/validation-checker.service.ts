import { Injectable } from '@nestjs/common';
import type {
  FormattedBlock,
  FormattingValidationError,
} from './formatting.types';

export interface ValidationCheckResult {
  errors: FormattingValidationError[];
  warnings: FormattingValidationError[];
}

@Injectable()
export class ValidationCheckerService {
  runValidationChecks(
    blocks: FormattedBlock[],
    templateParameters: Record<string, unknown>,
  ): FormattingValidationError[] {
    const issues: FormattingValidationError[] = [];

    issues.push(...this.checkWordCount(blocks, templateParameters));
    issues.push(...this.checkNumberConsistency(blocks));
    issues.push(...this.checkMissingSections(blocks, templateParameters));

    return issues;
  }

  private checkWordCount(
    blocks: FormattedBlock[],
    templateParameters: Record<string, unknown>,
  ): FormattingValidationError[] {
    const issues: FormattingValidationError[] = [];
    const restrictions = (templateParameters.restrictions ?? {}) as Record<
      string,
      unknown
    >;
    const minWords = restrictions.minWordCount as number | undefined;
    const maxWords = restrictions.maxWordCount as number | undefined;

    let totalWords = 0;
    for (const block of blocks) {
      if (block.text && typeof block.text === 'string') {
        const trimmed = block.text.trim();
        if (trimmed) {
          totalWords += trimmed.split(/\s+/).length;
        }
      }
    }

    if (minWords !== undefined && totalWords < minWords) {
      issues.push({
        severity: 'WARNING',
        code: 'WORD_COUNT_BELOW_MINIMUM',
        message: `Document has ${totalWords} words, minimum required is ${minWords}`,
      });
    }

    if (maxWords !== undefined && totalWords > maxWords) {
      issues.push({
        severity: 'ERROR',
        code: 'WORD_COUNT_EXCEEDS_MAXIMUM',
        message: `Document has ${totalWords} words, maximum allowed is ${maxWords}`,
      });
    }

    return issues;
  }

  private checkNumberConsistency(
    blocks: FormattedBlock[],
  ): FormattingValidationError[] {
    const issues: FormattingValidationError[] = [];

    const tableNumbers: number[] = [];
    const figureNumbers: number[] = [];
    const equationNumbers: number[] = [];

    blocks.forEach((block, index) => {
      const sequenceNumber = block.metadata?.sequenceNumber as
        | number
        | undefined;
      if (sequenceNumber === undefined) {
        return;
      }

      const blockType = block.blockType.toUpperCase();

      if (blockType === 'TABLE') {
        if (tableNumbers.includes(sequenceNumber)) {
          issues.push({
            severity: 'ERROR',
            code: 'DUPLICATE_TABLE_NUMBER',
            message: `Duplicate table number: ${sequenceNumber}`,
            blockIndex: index,
          });
        } else {
          tableNumbers.push(sequenceNumber);
        }
      } else if (blockType === 'FIGURE') {
        if (figureNumbers.includes(sequenceNumber)) {
          issues.push({
            severity: 'ERROR',
            code: 'DUPLICATE_FIGURE_NUMBER',
            message: `Duplicate figure number: ${sequenceNumber}`,
            blockIndex: index,
          });
        } else {
          figureNumbers.push(sequenceNumber);
        }
      } else if (blockType === 'EQUATION') {
        if (equationNumbers.includes(sequenceNumber)) {
          issues.push({
            severity: 'ERROR',
            code: 'DUPLICATE_EQUATION_NUMBER',
            message: `Duplicate equation number: ${sequenceNumber}`,
            blockIndex: index,
          });
        } else {
          equationNumbers.push(sequenceNumber);
        }
      }
    });

    this.checkSequenceGaps(issues, tableNumbers, 'TABLE');
    this.checkSequenceGaps(issues, figureNumbers, 'FIGURE');
    this.checkSequenceGaps(issues, equationNumbers, 'EQUATION');

    return issues;
  }

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
          message: `Missing ${type.toLowerCase()} number: ${i}`,
        });
      }
    }
  }

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

    if (fixedPages.abstract === true) {
      requiredSections.push('ABSTRACT');
    }
    if (fixedPages.declaration === true) {
      requiredSections.push('DECLARATION');
    }
    if (fixedPages.approval === true) {
      requiredSections.push('APPROVAL');
    }

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
      const semanticType =
        (block.metadata?.semanticSectionType as string) ?? '';
      if (semanticType) {
        presentSections.add(semanticType.toUpperCase());
      }
      const templateSlot = (block.metadata?.templateSlot as string) ?? '';
      if (templateSlot) {
        presentSections.add(templateSlot.toUpperCase());
      }
    }

    for (const section of requiredSections) {
      if (!presentSections.has(section)) {
        issues.push({
          severity: 'WARNING',
          code: 'MISSING_SECTION',
          message: `Required section "${section}" is missing from the document`,
        });
      }
    }

    return issues;
  }
}
