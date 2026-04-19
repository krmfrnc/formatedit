import { Injectable } from '@nestjs/common';
import type { FormattedBlock } from './formatting.types';

@Injectable()
export class AbbreviationsGeneratorService {
  /**
   * Generate abbreviations page with alphabetically sorted entries.
   */
  generateAbbreviations(
    entries: Array<{ abbreviation: string; expansion: string }>,
    fontFamily: string,
    fontSizePt: number,
  ): FormattedBlock[] {
    if (entries.length === 0) {
      return [];
    }

    const blocks: FormattedBlock[] = [];

    // Title
    blocks.push(this.buildBlock(blocks.length, 'HEADING', 'KISALTMALAR LİSTESİ', {
      typography: {
        fontFamily, fontSizePt: fontSizePt + 4, isBold: true,
        alignment: 'center', lineSpacing: 1.5,
        spacingBeforePt: 0, spacingAfterPt: 24, firstLineIndentCm: 0,
      },
      heading: { level: 1, numberingPattern: null, isInline: false, startsNewPage: true },
      templateSlot: 'ABBREVIATIONS',
    }));

    // Sort alphabetically using Turkish locale
    const sorted = [...entries].sort((a, b) =>
      a.abbreviation.localeCompare(b.abbreviation, 'tr'),
    );

    for (const entry of sorted) {
      blocks.push(this.buildBlock(blocks.length, 'PARAGRAPH',
        `${entry.abbreviation}\t: ${entry.expansion}`, {
          typography: {
            fontFamily, fontSizePt, isBold: false,
            alignment: 'left', lineSpacing: 1.5,
            spacingBeforePt: 2, spacingAfterPt: 2, firstLineIndentCm: 0,
          },
          templateSlot: 'ABBREVIATIONS',
        },
      ));
    }

    return blocks;
  }

  private buildBlock(
    orderIndex: number,
    blockType: string,
    text: string,
    metadata: Record<string, unknown>,
  ): FormattedBlock {
    return {
      orderIndex,
      blockType,
      appliedRules: ['PAGE_LAYOUT', 'FIXED_PAGE'],
      text,
      metadata: metadata as FormattedBlock['metadata'],
    };
  }
}
