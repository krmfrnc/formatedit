import { Injectable } from '@nestjs/common';
import type { FormattedBlock } from './formatting.types';

export interface TableOfContentsHeading {
  title: string;
  level: number;
  pageNumber?: number;
}

@Injectable()
export class TableOfContentsGeneratorService {
  generateTableOfContents(
    headings: TableOfContentsHeading[],
  ): FormattedBlock[] {
    const blocks: FormattedBlock[] = [];

    blocks.push({
      orderIndex: 0,
      blockType: 'HEADING',
      appliedRules: ['PAGE_LAYOUT', 'HEADING_STYLE'],
      text: 'TABLE OF CONTENTS',
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

    headings.forEach((heading, index) => {
      const indent = (heading.level - 1) * 1.25;
      const fontSize = heading.level === 1 ? 12 : 12;
      const isBold = heading.level <= 2;

      blocks.push({
        orderIndex: index + 1,
        blockType: 'PARAGRAPH',
        appliedRules: ['PAGE_LAYOUT', 'TYPOGRAPHY'],
        text: `${heading.title}${heading.pageNumber ? `\t${heading.pageNumber}` : ''}`,
        metadata: {
          fontFamily: 'Times New Roman',
          fontSizePt: fontSize,
          isBold,
          isItalic: false,
          alignment: 'left',
          lineSpacing: 1.5,
          firstLineIndentCm: indent,
        },
      });
    });

    return blocks;
  }
}
