import { Injectable } from '@nestjs/common';
import type { FormattedBlock } from './formatting.types';

export interface AbstractContent {
  text: string;
  keywords: string[];
  language: 'tr' | 'en';
}

@Injectable()
export class AbstractPageGeneratorService {
  generateAbstractPage(content: AbstractContent): FormattedBlock[] {
    const blocks: FormattedBlock[] = [];

    if (content.language === 'tr') {
      blocks.push({
        orderIndex: 0,
        blockType: 'HEADING',
        appliedRules: ['PAGE_LAYOUT', 'HEADING_STYLE'],
        text: 'OZET',
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

      blocks.push({
        orderIndex: 1,
        blockType: 'PARAGRAPH',
        appliedRules: ['PAGE_LAYOUT', 'TYPOGRAPHY'],
        text: content.text,
        metadata: {
          fontFamily: 'Times New Roman',
          fontSizePt: 12,
          alignment: 'justify',
          lineSpacing: 1.5,
          firstLineIndentCm: 1.25,
        },
      });

      if (content.keywords.length > 0) {
        blocks.push({
          orderIndex: 2,
          blockType: 'PARAGRAPH',
          appliedRules: ['PAGE_LAYOUT', 'TYPOGRAPHY'],
          text: `Anahtar Kelimeler: ${content.keywords.join(', ')}`,
          metadata: {
            fontFamily: 'Times New Roman',
            fontSizePt: 12,
            alignment: 'justify',
            lineSpacing: 1.5,
            firstLineIndentCm: 1.25,
          },
        });
      }
    } else {
      blocks.push({
        orderIndex: 0,
        blockType: 'HEADING',
        appliedRules: ['PAGE_LAYOUT', 'HEADING_STYLE'],
        text: 'ABSTRACT',
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

      blocks.push({
        orderIndex: 1,
        blockType: 'PARAGRAPH',
        appliedRules: ['PAGE_LAYOUT', 'TYPOGRAPHY'],
        text: content.text,
        metadata: {
          fontFamily: 'Times New Roman',
          fontSizePt: 12,
          alignment: 'justify',
          lineSpacing: 1.5,
          firstLineIndentCm: 1.25,
        },
      });

      if (content.keywords.length > 0) {
        blocks.push({
          orderIndex: 2,
          blockType: 'PARAGRAPH',
          appliedRules: ['PAGE_LAYOUT', 'TYPOGRAPHY'],
          text: `Keywords: ${content.keywords.join(', ')}`,
          metadata: {
            fontFamily: 'Times New Roman',
            fontSizePt: 12,
            alignment: 'justify',
            lineSpacing: 1.5,
            firstLineIndentCm: 1.25,
          },
        });
      }
    }

    return blocks;
  }
}
