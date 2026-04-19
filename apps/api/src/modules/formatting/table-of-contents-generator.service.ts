import { Injectable } from '@nestjs/common';
import type { FormattedBlock } from './formatting.types';

@Injectable()
export class TableOfContentsGeneratorService {
  /**
   * Generate table-of-contents blocks by scanning content blocks
   * for headings. Respects heading depth and applies level indentation.
   */
  generateTableOfContents(
    contentBlocks: FormattedBlock[],
    fontFamily: string,
    fontSizePt: number,
    maxDepth: number = 3,
  ): FormattedBlock[] {
    const blocks: FormattedBlock[] = [];

    // Title
    blocks.push(this.buildBlock(blocks.length, 'HEADING', 'İÇİNDEKİLER', {
      typography: {
        fontFamily, fontSizePt: fontSizePt + 4, isBold: true,
        alignment: 'center', lineSpacing: 1.5,
        spacingBeforePt: 0, spacingAfterPt: 24, firstLineIndentCm: 0,
      },
      heading: { level: 1, numberingPattern: null, isInline: false, startsNewPage: true },
      templateSlot: 'TABLE_OF_CONTENTS',
    }));

    // Extract headings from content blocks
    const headings = contentBlocks.filter(
      (b) =>
        b.blockType === 'HEADING' &&
        b.metadata?.heading?.level != null &&
        b.metadata.heading.level <= maxDepth,
    );

    for (const heading of headings) {
      const level = heading.metadata?.heading?.level ?? 1;
      const indent = (level - 1) * 1.25;
      const isBold = level <= 2;
      const numberingPattern = heading.metadata?.heading?.numberingPattern;
      const displayText = numberingPattern
        ? `${numberingPattern} ${heading.text}`
        : heading.text;

      blocks.push(this.buildBlock(blocks.length, 'PARAGRAPH', displayText, {
        typography: {
          fontFamily, fontSizePt, isBold, isItalic: false,
          alignment: 'left', lineSpacing: 1.5,
          spacingBeforePt: level === 1 ? 6 : 2,
          spacingAfterPt: 2,
          firstLineIndentCm: indent,
        },
        templateSlot: 'TABLE_OF_CONTENTS',
      }));
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
