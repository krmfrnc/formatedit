import { Injectable } from '@nestjs/common';
import type { FormattedBlock, TypographySettings } from './formatting.types';

@Injectable()
export class TypographyApplierService {
  applyTypography(
    blocks: FormattedBlock[],
    settings: TypographySettings,
  ): FormattedBlock[] {
    return blocks.map((block) => ({
      ...block,
      metadata: {
        ...(block.metadata ?? {}),
        fontFamily: settings.fontFamily,
        fontSizePt: settings.fontSizePt,
        lineSpacing: settings.lineSpacing,
        paragraphSpacingBeforePt: settings.paragraphSpacingBeforePt,
        paragraphSpacingAfterPt: settings.paragraphSpacingAfterPt,
        alignment: settings.alignment,
        firstLineIndentCm: settings.firstLineIndentCm,
      },
      appliedRules: [...block.appliedRules, 'TYPOGRAPHY'],
    }));
  }
}
