import { Injectable } from '@nestjs/common';
import type { FormattedBlock } from './formatting.types';

@Injectable()
export class TableListGeneratorService {
  /**
   * Generate "List of Tables" page by scanning content blocks for TABLE entries.
   */
  generateTableList(
    contentBlocks: FormattedBlock[],
    fontFamily: string,
    fontSizePt: number,
  ): FormattedBlock[] {
    const tables = contentBlocks.filter(
      (b) => b.blockType.toUpperCase() === 'TABLE' && b.metadata?.sequence,
    );

    if (tables.length === 0) {
      return [];
    }

    const blocks: FormattedBlock[] = [];

    // Title
    blocks.push(this.buildBlock(blocks.length, 'HEADING', 'TABLOLAR LİSTESİ', {
      typography: {
        fontFamily, fontSizePt: fontSizePt + 4, isBold: true,
        alignment: 'center', lineSpacing: 1.5,
        spacingBeforePt: 0, spacingAfterPt: 24, firstLineIndentCm: 0,
      },
      heading: { level: 1, numberingPattern: null, isInline: false, startsNewPage: true },
      templateSlot: 'TABLE_LIST',
    }));

    for (const table of tables) {
      const label = table.metadata?.sequence?.formattedLabel ?? '';
      const text = table.text.replace(/^(Tablo|Table)\s*\d+([.:]\d+)*[.:]*\s*/i, '');

      blocks.push(this.buildBlock(blocks.length, 'PARAGRAPH',
        `${label}: ${text}`, {
          typography: {
            fontFamily, fontSizePt, isBold: false,
            alignment: 'left', lineSpacing: 1.5,
            spacingBeforePt: 2, spacingAfterPt: 2, firstLineIndentCm: 0,
          },
          templateSlot: 'TABLE_LIST',
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
