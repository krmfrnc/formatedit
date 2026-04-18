import { Injectable } from '@nestjs/common';
import type { FormattedBlock } from './formatting.types';
import type { EditorPageNumberingSettings } from '@formatedit/shared';

@Injectable()
export class PageNumberingApplierService {
  applyPageNumbering(
    blocks: FormattedBlock[],
    settings: EditorPageNumberingSettings,
  ): FormattedBlock[] {
    let currentPage = 1;
    let isBodyStarted = false;

    return blocks.map((block) => {
      const blockPage = this.assignBlockPage(block, currentPage);
      const pageNumber = this.resolvePageNumber(
        blockPage,
        settings,
        isBodyStarted,
      );

      if (blockPage >= settings.bodyStartPage) {
        isBodyStarted = true;
      }

      currentPage = blockPage + 1;

      return {
        ...block,
        metadata: {
          ...(block.metadata ?? {}),
          pageNumber,
          pageNumberingStyle: this.getPageNumberingStyle(
            blockPage,
            settings,
            isBodyStarted,
          ),
        },
      };
    });
  }

  private assignBlockPage(_block: FormattedBlock, currentPage: number): number {
    return currentPage;
  }

  private resolvePageNumber(
    page: number,
    settings: EditorPageNumberingSettings,
    isBodyStarted: boolean,
  ): string | null {
    if (settings.unnumberedPages.includes(page)) {
      return null;
    }

    if (isBodyStarted && page >= settings.bodyStartPage) {
      const arabicNumber =
        page - settings.bodyStartPage + settings.bodyStartNumber;
      return String(arabicNumber);
    }

    if (settings.frontMatterStyle === 'roman') {
      return this.toRoman(page);
    }

    return String(page);
  }

  private getPageNumberingStyle(
    page: number,
    settings: EditorPageNumberingSettings,
    isBodyStarted: boolean,
  ): 'roman' | 'arabic' | 'none' {
    if (settings.unnumberedPages.includes(page)) {
      return 'none';
    }

    if (isBodyStarted && page >= settings.bodyStartPage) {
      return 'arabic';
    }

    return settings.frontMatterStyle;
  }

  private toRoman(num: number): string {
    if (num <= 0) return String(num);

    const romanMap: Array<[number, string]> = [
      [1000, 'M'],
      [900, 'CM'],
      [500, 'D'],
      [400, 'CD'],
      [100, 'C'],
      [90, 'XC'],
      [50, 'L'],
      [40, 'XL'],
      [10, 'X'],
      [9, 'IX'],
      [5, 'V'],
      [4, 'IV'],
      [1, 'I'],
    ];

    let result = '';
    let remaining = num;

    for (const [value, symbol] of romanMap) {
      while (remaining >= value) {
        result += symbol;
        remaining -= value;
      }
    }

    return result;
  }
}
