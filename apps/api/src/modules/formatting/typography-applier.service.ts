import { Injectable } from '@nestjs/common';
import type { FormattedBlock, TypographySettings } from './formatting.types';

@Injectable()
export class TypographyApplierService {
  /**
   * Apply typography metadata to all blocks. Headings are handled
   * separately by HeadingStyleApplierService, so we only apply
   * body-level typography here for non-heading blocks. For headings
   * that haven't been styled yet, we apply default typography.
   */
  applyTypography(
    blocks: FormattedBlock[],
    settings: TypographySettings,
  ): FormattedBlock[] {
    return blocks.map((block) => {
      // Skip blocks that already have typography from HeadingStyleApplier
      if (block.metadata?.typography && block.blockType === 'HEADING') {
        return block;
      }

      const typo = this.resolveTypographyForBlockType(block.blockType, settings);

      return {
        ...block,
        metadata: {
          ...block.metadata,
          typography: {
            fontFamily: typo.fontFamily,
            fontSizePt: typo.fontSizePt,
            isBold: typo.isBold,
            isItalic: typo.isItalic,
            alignment: typo.alignment,
            lineSpacing: typo.lineSpacing,
            spacingBeforePt: typo.spacingBeforePt,
            spacingAfterPt: typo.spacingAfterPt,
            firstLineIndentCm: typo.firstLineIndentCm,
          },
        },
        appliedRules: [...block.appliedRules, 'TYPOGRAPHY'],
      };
    });
  }

  /**
   * Resolve typography based on block type. Different block types
   * (paragraphs, captions, footnotes, etc.) use different sizes
   * per the v5 §4.9.2 specification.
   */
  private resolveTypographyForBlockType(
    blockType: string,
    settings: TypographySettings,
  ): {
    fontFamily: string;
    fontSizePt: number;
    isBold: boolean;
    isItalic: boolean;
    alignment: 'left' | 'center' | 'right' | 'justify';
    lineSpacing: number;
    spacingBeforePt: number;
    spacingAfterPt: number;
    firstLineIndentCm: number;
  } {
    const base = {
      fontFamily: settings.fontFamily,
      fontSizePt: settings.fontSizePt,
      isBold: false,
      isItalic: false,
      alignment: settings.alignment,
      lineSpacing: settings.lineSpacing,
      spacingBeforePt: settings.paragraphSpacingBeforePt,
      spacingAfterPt: settings.paragraphSpacingAfterPt,
      firstLineIndentCm: settings.firstLineIndentCm,
    };

    const normalized = blockType.toUpperCase();

    switch (normalized) {
      case 'TABLE':
      case 'TABLE_CAPTION':
        return {
          ...base,
          fontSizePt: settings.captionFontSizePt ?? settings.fontSizePt,
          isBold: true,
          alignment: 'center',
          firstLineIndentCm: 0,
          lineSpacing: 1.0,
        };

      case 'FIGURE':
      case 'FIGURE_CAPTION':
        return {
          ...base,
          fontSizePt: settings.captionFontSizePt ?? settings.fontSizePt,
          isItalic: true,
          alignment: 'center',
          firstLineIndentCm: 0,
          lineSpacing: 1.0,
        };

      case 'EQUATION':
        return {
          ...base,
          alignment: 'center',
          firstLineIndentCm: 0,
        };

      case 'FOOTNOTE':
        return {
          ...base,
          fontSizePt: settings.footnoteFontSizePt ?? 10,
          lineSpacing: 1.0,
          firstLineIndentCm: 0,
        };

      case 'TABLE_CONTENT':
        return {
          ...base,
          fontSizePt: settings.tableContentFontSizePt ?? 10,
          lineSpacing: 1.0,
          firstLineIndentCm: 0,
        };

      case 'REFERENCE':
      case 'BIBLIOGRAPHY':
        return {
          ...base,
          firstLineIndentCm: 0,
          // Hanging indent is applied at DOCX level, not here
        };

      case 'BLOCK_QUOTE':
        return {
          ...base,
          fontSizePt: settings.fontSizePt - 1,
          isItalic: true,
          firstLineIndentCm: 0,
        };

      default:
        return base;
    }
  }
}
