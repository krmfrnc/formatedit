import { Injectable } from '@nestjs/common';
import type {
  FormattedBlock,
  HeadingStyleLevel,
  HeadingStyleSettings,
} from './formatting.types';

@Injectable()
export class HeadingStyleApplierService {
  /**
   * Apply heading-specific formatting to all HEADING blocks.
   * Determines font, size, bold/italic, uppercase, alignment, spacing,
   * inline vs block, and pageBreakBefore from the level config.
   */
  applyHeadingStyles(
    blocks: FormattedBlock[],
    settings: HeadingStyleSettings,
  ): FormattedBlock[] {
    return blocks.map((block) => {
      if (block.blockType !== 'HEADING') {
        return block;
      }

      const rawLevel = (block.metadata?.heading?.level as number) ??
        (block.metadata as Record<string, unknown>)?.level as number ?? 1;
      const level = Math.min(Math.max(rawLevel, 1), 5);
      const levelConfig = this.findLevelConfig(settings.levels, level);

      if (!levelConfig) {
        return block;
      }

      // Apply uppercase transformation to text if configured
      const displayText = levelConfig.isUpperCase
        ? block.text.toLocaleUpperCase('tr')
        : block.text;

      return {
        ...block,
        text: displayText,
        metadata: {
          ...block.metadata,
          heading: {
            level,
            numberingPattern:
              block.metadata?.heading?.numberingPattern ?? null,
            isInline: levelConfig.isInline,
            startsNewPage: levelConfig.startsNewPage,
          },
          typography: {
            fontFamily: levelConfig.fontFamily,
            fontSizePt: levelConfig.fontSizePt,
            isBold: levelConfig.isBold,
            isItalic: levelConfig.isItalic,
            isUpperCase: levelConfig.isUpperCase,
            alignment: levelConfig.alignment,
            lineSpacing: block.metadata?.typography?.lineSpacing ?? 1.5,
            spacingBeforePt: levelConfig.spacingBeforePt,
            spacingAfterPt: levelConfig.spacingAfterPt,
            firstLineIndentCm: 0, // Headings typically have no first-line indent
          },
        },
        appliedRules: [...block.appliedRules, 'HEADING_STYLE'],
      };
    });
  }

  /**
   * Find the configuration for a specific heading level.
   * Falls back to the closest configured level if exact match not found.
   */
  private findLevelConfig(
    levels: HeadingStyleLevel[],
    targetLevel: number,
  ): HeadingStyleLevel | null {
    // Exact match
    const exact = levels.find((l) => l.level === targetLevel);
    if (exact) {
      return exact;
    }

    // Closest match — prefer closest higher level, then closest lower level
    const sorted = [...levels].sort(
      (a, b) =>
        Math.abs(a.level - targetLevel) - Math.abs(b.level - targetLevel),
    );

    return sorted[0] ?? null;
  }
}
