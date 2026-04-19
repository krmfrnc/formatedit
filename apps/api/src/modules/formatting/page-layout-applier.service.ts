import { Injectable } from '@nestjs/common';
import type { FormattedBlock, PageLayoutSettings } from './formatting.types';

@Injectable()
export class PageLayoutApplierService {
  /**
   * Apply page layout metadata (paper size, margins, orientation)
   * to all blocks. Also determines section break type for blocks
   * that start a new DOCX section (e.g. first heading-level-1 after
   * front matter triggers a section break for page numbering zones).
   */
  applyPageLayout(
    blocks: FormattedBlock[],
    settings: PageLayoutSettings,
  ): FormattedBlock[] {
    return blocks.map((block) => ({
      ...block,
      metadata: {
        ...block.metadata,
        pageLayout: {
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
      },
      appliedRules: [...block.appliedRules, 'PAGE_LAYOUT'],
    }));
  }
}
