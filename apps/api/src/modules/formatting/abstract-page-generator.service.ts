import { Injectable } from '@nestjs/common';
import type { AbstractConfig, FormattedBlock, StructuredAbstractSection } from './formatting.types';

export interface AbstractPageGeneratorInput extends AbstractConfig {
  fontFamily: string;
  fontSizePt: number;
}

@Injectable()
export class AbstractPageGeneratorService {
  /**
   * Generate abstract page with support for structured abstracts
   * (e.g. MDPI: Background/Objectives/Methods/Results/Conclusions).
   */
  generateAbstractPage(input: AbstractPageGeneratorInput): FormattedBlock[] {
    const blocks: FormattedBlock[] = [];
    const font = input.fontFamily;
    const basePt = input.fontSizePt;
    const isTurkish = input.language === 'tr';

    // Title
    const titleText = isTurkish ? 'ÖZET' : 'ABSTRACT';
    blocks.push(this.buildBlock(blocks.length, 'HEADING', titleText, {
      typography: {
        fontFamily: font, fontSizePt: basePt + 4, isBold: true,
        alignment: 'center', lineSpacing: 1.5,
        spacingBeforePt: 0, spacingAfterPt: 24, firstLineIndentCm: 0,
      },
      heading: { level: 1, numberingPattern: null, isInline: false, startsNewPage: true },
      templateSlot: isTurkish ? 'ABSTRACT_TR' : 'ABSTRACT_EN',
    }));

    // Thesis title (if provided)
    if (input.title) {
      blocks.push(this.buildBlock(blocks.length, 'PARAGRAPH', input.title, {
        typography: {
          fontFamily: font, fontSizePt: basePt, isBold: true,
          alignment: 'center', lineSpacing: 1.5,
          spacingBeforePt: 0, spacingAfterPt: 12, firstLineIndentCm: 0,
        },
        templateSlot: isTurkish ? 'ABSTRACT_TR' : 'ABSTRACT_EN',
      }));
    }

    // Author + date
    if (input.author) {
      const authorLine = input.date
        ? `${input.author}, ${input.date}`
        : input.author;
      blocks.push(this.buildBlock(blocks.length, 'PARAGRAPH', authorLine, {
        typography: {
          fontFamily: font, fontSizePt: basePt, isBold: false,
          alignment: 'center', lineSpacing: 1.5,
          spacingBeforePt: 0, spacingAfterPt: 18, firstLineIndentCm: 0,
        },
        templateSlot: isTurkish ? 'ABSTRACT_TR' : 'ABSTRACT_EN',
      }));
    }

    // Structured abstract sections (for journals like MDPI)
    if (input.structuredSections && input.structuredSections.length > 0) {
      for (const section of input.structuredSections) {
        blocks.push(...this.generateStructuredSection(
          blocks.length, section, font, basePt, isTurkish,
        ));
      }
    } else {
      // Simple abstract text
      blocks.push(this.buildBlock(blocks.length, 'PARAGRAPH', input.text, {
        typography: {
          fontFamily: font, fontSizePt: basePt, isBold: false,
          alignment: 'justify', lineSpacing: 1.5,
          spacingBeforePt: 0, spacingAfterPt: 12,
          firstLineIndentCm: 1.25,
        },
        templateSlot: isTurkish ? 'ABSTRACT_TR' : 'ABSTRACT_EN',
      }));
    }

    // Keywords
    if (input.keywords.length > 0) {
      const keywordLabel = isTurkish ? 'Anahtar Kelimeler' : 'Keywords';
      blocks.push(this.buildBlock(blocks.length, 'PARAGRAPH',
        `${keywordLabel}: ${input.keywords.join(', ')}`, {
          typography: {
            fontFamily: font, fontSizePt: basePt, isBold: false, isItalic: true,
            alignment: 'justify', lineSpacing: 1.5,
            spacingBeforePt: 12, spacingAfterPt: 0, firstLineIndentCm: 0,
          },
          templateSlot: isTurkish ? 'ABSTRACT_TR' : 'ABSTRACT_EN',
        },
      ));
    }

    return blocks;
  }

  private generateStructuredSection(
    startIndex: number,
    section: StructuredAbstractSection,
    font: string,
    basePt: number,
    isTurkish: boolean,
  ): FormattedBlock[] {
    const blocks: FormattedBlock[] = [];
    const slot = isTurkish ? 'ABSTRACT_TR' : 'ABSTRACT_EN';

    // Section heading (bold, inline with text)
    blocks.push(this.buildBlock(startIndex + blocks.length, 'PARAGRAPH',
      `${section.heading}: ${section.text}`, {
        typography: {
          fontFamily: font, fontSizePt: basePt, isBold: false,
          alignment: 'justify', lineSpacing: 1.5,
          spacingBeforePt: 6, spacingAfterPt: 6, firstLineIndentCm: 0,
        },
        templateSlot: slot,
      },
    ));

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
