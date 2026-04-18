import { Injectable } from '@nestjs/common';
import type { FormattedBlock } from './formatting.types';

export interface AbbreviationEntry {
  abbreviation: string;
  definition: string;
}

@Injectable()
export class AbbreviationsGeneratorService {
  generateAbbreviations(abbreviations: AbbreviationEntry[]): FormattedBlock[] {
    const blocks: FormattedBlock[] = [];

    blocks.push({
      orderIndex: 0,
      blockType: 'HEADING',
      appliedRules: ['PAGE_LAYOUT', 'HEADING_STYLE'],
      text: 'LIST OF ABBREVIATIONS',
      metadata: {
        level: 1,
        fontFamily: 'Times New Roman',
        fontSizePt: 16,
        isBold: true,
        isItalic: false,
        alignment: 'center',
        spacingBeforePt: 0,
        spacingAfterPt: 24,
      },
    });

    const sorted = [...abbreviations].sort((a, b) =>
      a.abbreviation.localeCompare(b.abbreviation),
    );

    sorted.forEach((entry, index) => {
      blocks.push({
        orderIndex: index + 1,
        blockType: 'PARAGRAPH',
        appliedRules: ['PAGE_LAYOUT', 'TYPOGRAPHY'],
        text: `${entry.abbreviation}: ${entry.definition}`,
        metadata: {
          fontFamily: 'Times New Roman',
          fontSizePt: 12,
          alignment: 'left',
          lineSpacing: 1.5,
          firstLineIndentCm: 0,
        },
      });
    });

    return blocks;
  }
}
