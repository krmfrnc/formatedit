import { Injectable } from '@nestjs/common';
import type { FormattedBlock } from './formatting.types';

export interface CoverPageMetadata {
  title: string;
  author: string;
  institution: string;
  institute?: string;
  department?: string;
  workType: string;
  advisor?: string;
  coAdvisor?: string;
  city?: string;
  date: string;
  fontFamily: string;
  fontSizePt: number;
}

@Injectable()
export class CoverPageGeneratorService {
  /**
   * Generate cover page blocks with full academic metadata.
   * All font/size values come from the template, not hardcoded.
   */
  generateCoverPage(metadata: CoverPageMetadata): FormattedBlock[] {
    const blocks: FormattedBlock[] = [];
    const font = metadata.fontFamily;
    const basePt = metadata.fontSizePt;

    // Institution name (university)
    if (metadata.institution) {
      blocks.push(this.buildBlock(blocks.length, 'HEADING', metadata.institution.toLocaleUpperCase('tr'), {
        typography: {
          fontFamily: font, fontSizePt: basePt + 2, isBold: true,
          alignment: 'center', lineSpacing: 1.5,
          spacingBeforePt: 0, spacingAfterPt: 6, firstLineIndentCm: 0,
        },
        heading: { level: 1, numberingPattern: null, isInline: false, startsNewPage: false },
        templateSlot: 'COVER',
      }));
    }

    // Institute name
    if (metadata.institute) {
      blocks.push(this.buildBlock(blocks.length, 'PARAGRAPH', metadata.institute.toLocaleUpperCase('tr'), {
        typography: {
          fontFamily: font, fontSizePt: basePt, isBold: true,
          alignment: 'center', lineSpacing: 1.5,
          spacingBeforePt: 0, spacingAfterPt: 6, firstLineIndentCm: 0,
        },
        templateSlot: 'COVER',
      }));
    }

    // Department name
    if (metadata.department) {
      blocks.push(this.buildBlock(blocks.length, 'PARAGRAPH', metadata.department.toLocaleUpperCase('tr'), {
        typography: {
          fontFamily: font, fontSizePt: basePt, isBold: true,
          alignment: 'center', lineSpacing: 1.5,
          spacingBeforePt: 0, spacingAfterPt: 24, firstLineIndentCm: 0,
        },
        templateSlot: 'COVER',
      }));
    }

    // Work type (e.g. YÜKSEK LİSANS TEZİ)
    blocks.push(this.buildBlock(blocks.length, 'PARAGRAPH', metadata.workType.toLocaleUpperCase('tr'), {
      typography: {
        fontFamily: font, fontSizePt: basePt + 4, isBold: true,
        alignment: 'center', lineSpacing: 1.5,
        spacingBeforePt: 48, spacingAfterPt: 24, firstLineIndentCm: 0,
      },
      templateSlot: 'COVER',
    }));

    // Thesis/work title
    blocks.push(this.buildBlock(blocks.length, 'HEADING', metadata.title.toLocaleUpperCase('tr'), {
      typography: {
        fontFamily: font, fontSizePt: basePt + 4, isBold: true,
        alignment: 'center', lineSpacing: 1.5,
        spacingBeforePt: 12, spacingAfterPt: 48, firstLineIndentCm: 0,
      },
      heading: { level: 1, numberingPattern: null, isInline: false, startsNewPage: false },
      templateSlot: 'COVER',
    }));

    // Author name
    blocks.push(this.buildBlock(blocks.length, 'PARAGRAPH', metadata.author, {
      typography: {
        fontFamily: font, fontSizePt: basePt, isBold: true,
        alignment: 'center', lineSpacing: 1.5,
        spacingBeforePt: 12, spacingAfterPt: 24, firstLineIndentCm: 0,
      },
      templateSlot: 'COVER',
    }));

    // Advisor
    if (metadata.advisor) {
      blocks.push(this.buildBlock(blocks.length, 'PARAGRAPH', `Danışman: ${metadata.advisor}`, {
        typography: {
          fontFamily: font, fontSizePt: basePt, isBold: false,
          alignment: 'center', lineSpacing: 1.5,
          spacingBeforePt: 6, spacingAfterPt: 6, firstLineIndentCm: 0,
        },
        templateSlot: 'COVER',
      }));
    }

    // Co-advisor
    if (metadata.coAdvisor) {
      blocks.push(this.buildBlock(blocks.length, 'PARAGRAPH', `Eş Danışman: ${metadata.coAdvisor}`, {
        typography: {
          fontFamily: font, fontSizePt: basePt, isBold: false,
          alignment: 'center', lineSpacing: 1.5,
          spacingBeforePt: 0, spacingAfterPt: 6, firstLineIndentCm: 0,
        },
        templateSlot: 'COVER',
      }));
    }

    // City and date
    const cityDate = [metadata.city, metadata.date].filter(Boolean).join(', ');
    if (cityDate) {
      blocks.push(this.buildBlock(blocks.length, 'PARAGRAPH', cityDate, {
        typography: {
          fontFamily: font, fontSizePt: basePt, isBold: false,
          alignment: 'center', lineSpacing: 1.5,
          spacingBeforePt: 48, spacingAfterPt: 0, firstLineIndentCm: 0,
        },
        templateSlot: 'COVER',
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
