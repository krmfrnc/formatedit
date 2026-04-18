import { Injectable } from '@nestjs/common';
import type { FormattedBlock } from './formatting.types';

export interface EducationEntry {
  degree: string;
  institution: string;
  year: string;
}

export interface CVMetadata {
  name: string;
  birthDate: string;
  education: EducationEntry[];
}

@Injectable()
export class CVGeneratorService {
  generateCV(metadata: CVMetadata): FormattedBlock[] {
    const blocks: FormattedBlock[] = [];

    blocks.push({
      orderIndex: 0,
      blockType: 'HEADING',
      appliedRules: ['PAGE_LAYOUT', 'HEADING_STYLE'],
      text: 'OZGECMIS',
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
      blockType: 'HEADING',
      appliedRules: ['PAGE_LAYOUT', 'HEADING_STYLE'],
      text: metadata.name,
      metadata: {
        level: 2,
        fontFamily: 'Times New Roman',
        fontSizePt: 14,
        isBold: true,
        isItalic: false,
        alignment: 'left',
        spacingBeforePt: 10,
        spacingAfterPt: 6,
      },
    });

    blocks.push({
      orderIndex: 2,
      blockType: 'PARAGRAPH',
      appliedRules: ['PAGE_LAYOUT', 'TYPOGRAPHY'],
      text: `Date of Birth: ${metadata.birthDate}`,
      metadata: {
        fontFamily: 'Times New Roman',
        fontSizePt: 12,
        alignment: 'left',
        lineSpacing: 1.5,
      },
    });

    blocks.push({
      orderIndex: 3,
      blockType: 'HEADING',
      appliedRules: ['PAGE_LAYOUT', 'HEADING_STYLE'],
      text: 'Education',
      metadata: {
        level: 2,
        fontFamily: 'Times New Roman',
        fontSizePt: 14,
        isBold: true,
        isItalic: false,
        alignment: 'left',
        spacingBeforePt: 10,
        spacingAfterPt: 6,
      },
    });

    metadata.education.forEach((edu, index) => {
      blocks.push({
        orderIndex: 4 + index * 2,
        blockType: 'PARAGRAPH',
        appliedRules: ['PAGE_LAYOUT', 'TYPOGRAPHY'],
        text: `${edu.degree} - ${edu.institution}`,
        metadata: {
          fontFamily: 'Times New Roman',
          fontSizePt: 12,
          isBold: true,
          alignment: 'left',
          lineSpacing: 1.5,
          firstLineIndentCm: 1.25,
        },
      });

      blocks.push({
        orderIndex: 5 + index * 2,
        blockType: 'PARAGRAPH',
        appliedRules: ['PAGE_LAYOUT', 'TYPOGRAPHY'],
        text: `${edu.year}`,
        metadata: {
          fontFamily: 'Times New Roman',
          fontSizePt: 12,
          alignment: 'left',
          lineSpacing: 1.5,
          firstLineIndentCm: 1.25,
        },
      });
    });

    return blocks;
  }
}
