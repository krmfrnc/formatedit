import { Injectable } from '@nestjs/common';
import type { FormattedBlock } from './formatting.types';

export interface ApprovalPageMetadata {
  title: string;
  author: string;
  date: string;
}

@Injectable()
export class ApprovalPageGeneratorService {
  generateApprovalPage(metadata: ApprovalPageMetadata): FormattedBlock[] {
    const blocks: FormattedBlock[] = [];

    blocks.push({
      orderIndex: 0,
      blockType: 'HEADING',
      appliedRules: ['PAGE_LAYOUT', 'HEADING_STYLE'],
      text: 'ONAY SAYFASI',
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
      text: metadata.title,
      metadata: {
        fontFamily: 'Times New Roman',
        fontSizePt: 12,
        isBold: true,
        alignment: 'center',
        lineSpacing: 1.5,
      },
    });

    blocks.push({
      orderIndex: 2,
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
      orderIndex: 3,
      blockType: 'PARAGRAPH',
      appliedRules: ['PAGE_LAYOUT', 'TYPOGRAPHY'],
      text: `Date: ${metadata.date}`,
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
      text: '',
      metadata: {
        fontFamily: 'Times New Roman',
        fontSizePt: 12,
        alignment: 'left',
        lineSpacing: 1.5,
      },
    });

    blocks.push({
      orderIndex: 5,
      blockType: 'PARAGRAPH',
      appliedRules: ['PAGE_LAYOUT', 'TYPOGRAPHY'],
      text: 'Advisor Signature: _______________________',
      metadata: {
        fontFamily: 'Times New Roman',
        fontSizePt: 12,
        alignment: 'left',
        lineSpacing: 1.5,
      },
    });

    blocks.push({
      orderIndex: 6,
      blockType: 'PARAGRAPH',
      appliedRules: ['PAGE_LAYOUT', 'TYPOGRAPHY'],
      text: 'Committee Member Signature: _______________________',
      metadata: {
        fontFamily: 'Times New Roman',
        fontSizePt: 12,
        alignment: 'left',
        lineSpacing: 1.5,
      },
    });

    blocks.push({
      orderIndex: 7,
      blockType: 'PARAGRAPH',
      appliedRules: ['PAGE_LAYOUT', 'TYPOGRAPHY'],
      text: 'Committee Member Signature: _______________________',
      metadata: {
        fontFamily: 'Times New Roman',
        fontSizePt: 12,
        alignment: 'left',
        lineSpacing: 1.5,
      },
    });

    return blocks;
  }
}
