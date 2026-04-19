import { Injectable } from '@nestjs/common';
import type { FormattedBlock } from './formatting.types';

export interface CVInput {
  text?: string;
  format?: 'freeText' | 'yok';
}

@Injectable()
export class CVGeneratorService {
  /**
   * Generate CV/biography page. Supports free-text and YÖK format.
   */
  generateCV(
    input: CVInput,
    fontFamily: string,
    fontSizePt: number,
  ): FormattedBlock[] {
    const blocks: FormattedBlock[] = [];

    // Title
    blocks.push(this.buildBlock(blocks.length, 'HEADING', 'ÖZGEÇMİŞ', {
      typography: {
        fontFamily, fontSizePt: fontSizePt + 4, isBold: true,
        alignment: 'center', lineSpacing: 1.5,
        spacingBeforePt: 0, spacingAfterPt: 24, firstLineIndentCm: 0,
      },
      heading: { level: 1, numberingPattern: null, isInline: false, startsNewPage: true },
      templateSlot: 'CV',
    }));

    if (input.text) {
      // Split text by paragraphs
      const paragraphs = input.text.split(/\n{2,}/).filter(Boolean);

      for (const paragraph of paragraphs) {
        blocks.push(this.buildBlock(blocks.length, 'PARAGRAPH', paragraph.trim(), {
          typography: {
            fontFamily, fontSizePt, isBold: false,
            alignment: 'justify', lineSpacing: 1.5,
            spacingBeforePt: 0, spacingAfterPt: 6,
            firstLineIndentCm: 1.25,
          },
          templateSlot: 'CV',
        }));
      }
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
