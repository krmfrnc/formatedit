import { Injectable } from '@nestjs/common';
import type { FormattedBlock } from './formatting.types';

export interface DeclarationMetadata {
  author: string;
  date: string;
  language: 'tr' | 'en';
}

@Injectable()
export class DeclarationGeneratorService {
  generateDeclaration(metadata: DeclarationMetadata): FormattedBlock[] {
    const blocks: FormattedBlock[] = [];

    if (metadata.language === 'tr') {
      blocks.push({
        orderIndex: 0,
        blockType: 'HEADING',
        appliedRules: ['PAGE_LAYOUT', 'HEADING_STYLE'],
        text: 'BEYANNAME',
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
        text: `Bu tezde kullanılan bilgilerin tamamının akademik kurallara ve bilimsel etik ilkelere uygun olarak elde edildiğini beyan ederim.`,
        metadata: {
          fontFamily: 'Times New Roman',
          fontSizePt: 12,
          alignment: 'justify',
          lineSpacing: 1.5,
          firstLineIndentCm: 1.25,
        },
      });

      blocks.push({
        orderIndex: 2,
        blockType: 'PARAGRAPH',
        appliedRules: ['PAGE_LAYOUT', 'TYPOGRAPHY'],
        text: `Ayrıca bu tezde kullanılan veriler, bilgiler ve tabloların kaynak gösterilmeden sunulmadığını taahhüt ederim.`,
        metadata: {
          fontFamily: 'Times New Roman',
          fontSizePt: 12,
          alignment: 'justify',
          lineSpacing: 1.5,
          firstLineIndentCm: 1.25,
        },
      });
    } else {
      blocks.push({
        orderIndex: 0,
        blockType: 'HEADING',
        appliedRules: ['PAGE_LAYOUT', 'HEADING_STYLE'],
        text: 'DECLARATION',
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
        text: `I hereby declare that all information in this thesis has been obtained and presented in accordance with academic rules and ethical principles.`,
        metadata: {
          fontFamily: 'Times New Roman',
          fontSizePt: 12,
          alignment: 'justify',
          lineSpacing: 1.5,
          firstLineIndentCm: 1.25,
        },
      });

      blocks.push({
        orderIndex: 2,
        blockType: 'PARAGRAPH',
        appliedRules: ['PAGE_LAYOUT', 'TYPOGRAPHY'],
        text: `Furthermore, I declare that all data, information, and tables used in this thesis have not been presented without citing sources.`,
        metadata: {
          fontFamily: 'Times New Roman',
          fontSizePt: 12,
          alignment: 'justify',
          lineSpacing: 1.5,
          firstLineIndentCm: 1.25,
        },
      });
    }

    blocks.push({
      orderIndex: 3,
      blockType: 'PARAGRAPH',
      appliedRules: ['PAGE_LAYOUT', 'TYPOGRAPHY'],
      text: '',
      metadata: {
        fontFamily: 'Times New Roman',
        fontSizePt: 12,
        alignment: 'left',
        lineSpacing: 1.5,
      },
    });

    blocks.push({
      orderIndex: 4,
      blockType: 'PARAGRAPH',
      appliedRules: ['PAGE_LAYOUT', 'TYPOGRAPHY'],
      text: `${metadata.author}`,
      metadata: {
        fontFamily: 'Times New Roman',
        fontSizePt: 12,
        alignment: 'right',
        lineSpacing: 1.5,
      },
    });

    blocks.push({
      orderIndex: 5,
      blockType: 'PARAGRAPH',
      appliedRules: ['PAGE_LAYOUT', 'TYPOGRAPHY'],
      text: `${metadata.date}`,
      metadata: {
        fontFamily: 'Times New Roman',
        fontSizePt: 12,
        alignment: 'right',
        lineSpacing: 1.5,
      },
    });

    return blocks;
  }
}
