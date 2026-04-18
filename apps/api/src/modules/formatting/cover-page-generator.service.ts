import { Injectable } from '@nestjs/common';
import type { FormattedBlock } from './formatting.types';

export interface CoverPageMetadata {
  title: string;
  author: string;
  institution: string;
  date: string;
  workType: string;
}

@Injectable()
export class CoverPageGeneratorService {
  generateCoverPage(metadata: CoverPageMetadata): FormattedBlock[] {
    const blocks: FormattedBlock[] = [];

    blocks.push({
      orderIndex: 0,
      blockType: 'HEADING',
      appliedRules: ['PAGE_LAYOUT', 'HEADING_STYLE'],
      text: metadata.institution,
      metadata: {
        level: 1,
        fontFamily: 'Times New Roman',
        fontSizePt: 14,
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
      text: metadata.workType.toUpperCase(),
      metadata: {
        level: 1,
        fontFamily: 'Times New Roman',
        fontSizePt: 16,
        isBold: true,
        isItalic: false,
        alignment: 'center',
        spacingBeforePt: 12,
        spacingAfterPt: 24,
      },
    });

    blocks.push({
      orderIndex: 2,
      blockType: 'HEADING',
      appliedRules: ['PAGE_LAYOUT', 'HEADING_STYLE'],
      text: metadata.title,
      metadata: {
        level: 1,
        fontFamily: 'Times New Roman',
        fontSizePt: 16,
        isBold: true,
        isItalic: false,
        alignment: 'center',
        spacingBeforePt: 12,
        spacingAfterPt: 36,
      },
    });

    blocks.push({
      orderIndex: 3,
      blockType: 'PARAGRAPH',
      appliedRules: ['PAGE_LAYOUT', 'TYPOGRAPHY'],
      text: `Author: ${metadata.author}`,
      metadata: {
        fontFamily: 'Times New Roman',
        fontSizePt: 12,
        alignment: 'center',
        lineSpacing: 1.5,
      },
    });

    blocks.push({
      orderIndex: 4,
      blockType: 'PARAGRAPH',
      appliedRules: ['PAGE_LAYOUT', 'TYPOGRAPHY'],
      text: metadata.date,
      metadata: {
        fontFamily: 'Times New Roman',
        fontSizePt: 12,
        alignment: 'center',
        lineSpacing: 1.5,
      },
    });

    return blocks;
  }
}
