import { Injectable } from '@nestjs/common';
import type { FormattedBlock } from './formatting.types';

@Injectable()
export class FigureListGeneratorService {
  /**
   * Generate "List of Figures" page by scanning content blocks for FIGURE entries.
   */
  generateFigureList(
    contentBlocks: FormattedBlock[],
    fontFamily: string,
    fontSizePt: number,
  ): FormattedBlock[] {
    const figures = contentBlocks.filter(
      (b) => b.blockType.toUpperCase() === 'FIGURE' && b.metadata?.sequence,
    );

    if (figures.length === 0) {
      return [];
    }

    const blocks: FormattedBlock[] = [];

    // Title
    blocks.push(this.buildBlock(blocks.length, 'HEADING', 'ŞEKİLLER LİSTESİ', {
      typography: {
        fontFamily, fontSizePt: fontSizePt + 4, isBold: true,
        alignment: 'center', lineSpacing: 1.5,
        spacingBeforePt: 0, spacingAfterPt: 24, firstLineIndentCm: 0,
      },
      heading: { level: 1, numberingPattern: null, isInline: false, startsNewPage: true },
      templateSlot: 'FIGURE_LIST',
    }));

    for (const figure of figures) {
      const label = figure.metadata?.sequence?.formattedLabel ?? '';
      const text = figure.text.replace(/^(Şekil|Sekil|Figure)\s*\d+([.:]\d+)*[.:]*\s*/i, '');

      blocks.push(this.buildBlock(blocks.length, 'PARAGRAPH',
        `${label}: ${text}`, {
          typography: {
            fontFamily, fontSizePt, isBold: false,
            alignment: 'left', lineSpacing: 1.5,
            spacingBeforePt: 2, spacingAfterPt: 2, firstLineIndentCm: 0,
          },
          templateSlot: 'FIGURE_LIST',
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
