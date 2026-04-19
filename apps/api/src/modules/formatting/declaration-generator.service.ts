import { Injectable } from '@nestjs/common';
import type { FormattedBlock } from './formatting.types';

export interface DeclarationInput {
  text?: string;
  showSignature?: boolean;
  fontFamily: string;
  fontSizePt: number;
}

const DEFAULT_DECLARATION_TR =
  'Bu tezdeki tüm bilgilerin akademik kurallara ve bilimsel etik ilkelere uygun olarak elde edildiğini beyan ederim. ' +
  'Ayrıca bu çalışmada kullanılan veriler, bilgiler ve tabloların kaynak gösterilmeden sunulmadığını taahhüt ederim.';

@Injectable()
export class DeclarationGeneratorService {
  generateDeclaration(input: DeclarationInput): FormattedBlock[] {
    const blocks: FormattedBlock[] = [];
    const font = input.fontFamily;
    const basePt = input.fontSizePt;

    // Title
    blocks.push(this.buildBlock(blocks.length, 'HEADING', 'BEYANNAME', {
      typography: {
        fontFamily: font, fontSizePt: basePt + 4, isBold: true,
        alignment: 'center', lineSpacing: 1.5,
        spacingBeforePt: 0, spacingAfterPt: 24, firstLineIndentCm: 0,
      },
      heading: { level: 1, numberingPattern: null, isInline: false, startsNewPage: true },
      templateSlot: 'DECLARATION',
    }));

    // Declaration text (custom or default)
    const text = input.text?.trim() || DEFAULT_DECLARATION_TR;
    blocks.push(this.buildBlock(blocks.length, 'PARAGRAPH', text, {
      typography: {
        fontFamily: font, fontSizePt: basePt, isBold: false,
        alignment: 'justify', lineSpacing: 1.5,
        spacingBeforePt: 0, spacingAfterPt: 36,
        firstLineIndentCm: 1.25,
      },
      templateSlot: 'DECLARATION',
    }));

    // Signature area
    if (input.showSignature !== false) {
      blocks.push(this.buildBlock(blocks.length, 'PARAGRAPH', 'İmza', {
        typography: {
          fontFamily: font, fontSizePt: basePt, isBold: false,
          alignment: 'right', lineSpacing: 1.5,
          spacingBeforePt: 48, spacingAfterPt: 6, firstLineIndentCm: 0,
        },
        templateSlot: 'DECLARATION',
      }));

      blocks.push(this.buildBlock(blocks.length, 'PARAGRAPH', 'Ad Soyad', {
        typography: {
          fontFamily: font, fontSizePt: basePt, isBold: false,
          alignment: 'right', lineSpacing: 1.5,
          spacingBeforePt: 0, spacingAfterPt: 6, firstLineIndentCm: 0,
        },
        templateSlot: 'DECLARATION',
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
