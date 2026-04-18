import { Injectable } from '@nestjs/common';
import type { FormattedBlock, PageLayoutSettings } from './formatting.types';

@Injectable()
export class PageLayoutApplierService {
  applyPageLayout(
    blocks: FormattedBlock[],
    settings: PageLayoutSettings,
  ): FormattedBlock[] {
    return blocks.map((block) => ({
      ...block,
      metadata: {
        ...(block.metadata ?? {}),
        paperSize: settings.paperSize,
        orientation: settings.orientation,
        marginTopCm: settings.marginTopCm,
        marginBottomCm: settings.marginBottomCm,
        marginLeftCm: settings.marginLeftCm,
        marginRightCm: settings.marginRightCm,
        headerMarginCm: settings.headerMarginCm,
        footerMarginCm: settings.footerMarginCm,
        gutterCm: settings.gutterCm,
      },
      appliedRules: [...block.appliedRules, 'PAGE_LAYOUT'],
    }));
  }
}
