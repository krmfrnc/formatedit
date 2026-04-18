import { Injectable } from '@nestjs/common';
import type { FormattedBlock, HeadingStyleSettings } from './formatting.types';

@Injectable()
export class HeadingStyleApplierService {
  applyHeadingStyles(
    blocks: FormattedBlock[],
    settings: HeadingStyleSettings,
  ): FormattedBlock[] {
    return blocks.map((block) => {
      if (block.blockType !== 'HEADING') {
        return block;
      }

      const level = this.extractLevel(block);
      const headingLevel = settings.levels.find(
        (entry) => entry.level === level,
      );

      if (!headingLevel) {
        return block;
      }

      return {
        ...block,
        metadata: {
          ...(block.metadata ?? {}),
          fontFamily: headingLevel.fontFamily,
          fontSizePt: headingLevel.fontSizePt,
          isBold: headingLevel.isBold,
          isItalic: headingLevel.isItalic,
          alignment: headingLevel.alignment,
          spacingBeforePt: headingLevel.spacingBeforePt,
          spacingAfterPt: headingLevel.spacingAfterPt,
          numberingFormat: headingLevel.numberingFormat,
        },
        appliedRules: [...block.appliedRules, 'HEADING_STYLE'],
      };
    });
  }

  private extractLevel(block: FormattedBlock): number {
    return (block.metadata?.level as number | null) ?? 1;
  }
}
