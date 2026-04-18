import { Injectable } from '@nestjs/common';
import type { FormattedBlock } from './formatting.types';

export interface FigureListItem {
  label: string;
  title: string;
  pageNumber?: number;
}

@Injectable()
export class FigureListGeneratorService {
  generateFigureList(figures: FigureListItem[]): FormattedBlock[] {
    const blocks: FormattedBlock[] = [];

    blocks.push({
      orderIndex: 0,
      blockType: 'HEADING',
      appliedRules: ['PAGE_LAYOUT', 'HEADING_STYLE'],
      text: 'LIST OF FIGURES',
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

    figures.forEach((figure, index) => {
      blocks.push({
        orderIndex: index + 1,
        blockType: 'PARAGRAPH',
        appliedRules: ['PAGE_LAYOUT', 'TYPOGRAPHY'],
        text: `${figure.label} ${figure.title}${figure.pageNumber ? `\t${figure.pageNumber}` : ''}`,
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
