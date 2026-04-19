import { Injectable } from '@nestjs/common';
import type {
  FormattedBlock,
  PageNumberingSettings,
  PageNumberZone,
} from './formatting.types';

@Injectable()
export class PageNumberingApplierService {
  /**
   * Applies page numbering metadata to blocks using the zone system.
   * Each zone defines a range of pages with a specific numbering style
   * (roman, arabic, none), position, and start number.
   */
  applyPageNumbering(
    blocks: FormattedBlock[],
    settings: PageNumberingSettings,
  ): FormattedBlock[] {
    let currentPage = 1;

    return blocks.map((block) => {
      const zone = this.findZone(settings.zones, currentPage);
      const isUnnumbered = settings.unnumberedPages.includes(currentPage);

      const pageNumber = isUnnumbered || !zone
        ? null
        : this.formatPageNumber(currentPage, zone);

      const pageNumberStyle = isUnnumbered
        ? 'none' as const
        : zone?.style ?? ('none' as const);

      const result: FormattedBlock = {
        ...block,
        metadata: {
          ...block.metadata,
          pageNumber: {
            pageNumber,
            pageNumberStyle,
            pageNumberPosition: zone?.position ?? 'bottom-center',
            pageNumberFontFamily: zone?.fontFamily ?? 'Times New Roman',
            pageNumberFontSizePt: zone?.fontSizePt ?? 12,
          },
        },
        appliedRules: [...block.appliedRules, 'PAGE_NUMBERING'],
      };

      currentPage += 1;
      return result;
    });
  }

  /**
   * Find the active zone for a given page number.
   */
  private findZone(
    zones: PageNumberZone[],
    page: number,
  ): PageNumberZone | null {
    for (const zone of zones) {
      const inStart = page >= zone.startPage;
      const inEnd = zone.endPage === null || page <= zone.endPage;

      if (inStart && inEnd) {
        return zone;
      }
    }

    return null;
  }

  /**
   * Format a page number based on the zone's style and start number.
   */
  private formatPageNumber(
    absolutePage: number,
    zone: PageNumberZone,
  ): string {
    const relativeNumber = absolutePage - zone.startPage + zone.startNumber;

    if (zone.style === 'none') {
      return '';
    }

    if (zone.style === 'roman') {
      return this.toRoman(relativeNumber).toLowerCase();
    }

    return String(relativeNumber);
  }

  /**
   * Convert integer to Roman numerals.
   */
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
