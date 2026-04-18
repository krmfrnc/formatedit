import { Injectable } from '@nestjs/common';
import type { CitationParseResult, ParsedCitation } from './citation.types';
import type {
  CitationBibliographyOrderEntry,
  CitationBibliographyOrderInput,
  CitationBibliographyOrderResult,
} from './citation-bibliography-order.types';
import { authorDateStyles, notesBibliographyStyles, numericStyles, type CitationStyleSlug } from './citation.constants';
import type { CitationFamily } from './citation.types';

@Injectable()
export class CitationBibliographyOrderService {
  sortBibliography(
    input: CitationBibliographyOrderInput,
  ): CitationBibliographyOrderResult {
    const normalized = this.normalizeBibliography(
      input.bibliography,
      input.bibliographyStyle,
    );
    const entries = [...normalized.entries];
    const sortedEntries =
      input.orderMode === 'citation-order'
        ? this.sortByCitationOrder(entries)
        : this.sortAlphabetically(entries);

    const resultEntries = sortedEntries.map((entry, index) =>
      this.decorateEntry(entry, index),
    );
    const movedCount = resultEntries.filter((entry) => entry.moved).length;

    return {
      sourceStyle: normalized.sourceStyle,
      sourceFamily: normalized.sourceFamily,
      orderMode: input.orderMode,
      entryCount: resultEntries.length,
      movedCount,
      bibliographyText: resultEntries
        .map((entry) => entry.rawText)
        .join('\n\n'),
      entries: resultEntries,
    };
  }

  private normalizeBibliography(
    bibliography: CitationParseResult | ParsedCitation[],
    bibliographyStyle?: CitationStyleSlug,
  ): {
    entries: ParsedCitation[];
    sourceStyle: CitationStyleSlug | 'unknown';
    sourceFamily: CitationFamily | 'unknown';
  } {
    if (!Array.isArray(bibliography)) {
      return {
        entries: [...bibliography.entries],
        sourceStyle: bibliography.style,
        sourceFamily: bibliography.family,
      };
    }

    return {
      entries: [...bibliography],
      sourceStyle: bibliographyStyle ?? 'unknown',
      sourceFamily: this.resolveFamily(bibliographyStyle),
    };
  }

  private sortByCitationOrder(entries: ParsedCitation[]): ParsedCitation[] {
    return [...entries].sort((left, right) => {
      if (left.orderIndex !== right.orderIndex) {
        return left.orderIndex - right.orderIndex;
      }

      return this.compareFallback(left, right);
    });
  }

  private sortAlphabetically(entries: ParsedCitation[]): ParsedCitation[] {
    return [...entries].sort((left, right) => {
      const leftKey = this.buildAlphabeticalSortKey(left);
      const rightKey = this.buildAlphabeticalSortKey(right);

      if (leftKey !== rightKey) {
        return leftKey.localeCompare(rightKey);
      }

      return this.compareFallback(left, right);
    });
  }

  private decorateEntry(
    entry: ParsedCitation,
    sortedOrderIndex: number,
  ): CitationBibliographyOrderEntry {
    const originalOrderIndex = entry.orderIndex;
    return {
      ...entry,
      originalOrderIndex,
      sortedOrderIndex,
      sortKey: this.buildAlphabeticalSortKey(entry),
      moved: originalOrderIndex !== sortedOrderIndex,
      orderIndex: sortedOrderIndex,
    };
  }

  private buildAlphabeticalSortKey(entry: ParsedCitation): string {
    const primary =
      this.normalizeSortToken(entry.authors[0] ?? entry.containerTitle ?? entry.title ?? entry.publisher ?? 'zzz');
    const secondary = entry.year ? String(entry.year).padStart(4, '0') : '9999';
    const tertiary = this.normalizeSortToken(entry.title ?? entry.containerTitle ?? '');

    return `${primary}|${secondary}|${tertiary}|${String(entry.orderIndex).padStart(6, '0')}`;
  }

  private compareFallback(left: ParsedCitation, right: ParsedCitation): number {
    if (left.year !== right.year) {
      return (left.year ?? Number.MAX_SAFE_INTEGER) - (right.year ?? Number.MAX_SAFE_INTEGER);
    }

    const leftTitle = this.normalizeSortToken(left.title ?? left.containerTitle ?? left.rawText);
    const rightTitle = this.normalizeSortToken(right.title ?? right.containerTitle ?? right.rawText);
    if (leftTitle !== rightTitle) {
      return leftTitle.localeCompare(rightTitle);
    }

    return left.orderIndex - right.orderIndex;
  }

  private normalizeSortToken(value: string): string {
    return value
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, ' ')
      .trim()
      .replace(/\s+/g, ' ');
  }

  private resolveFamily(
    style?: CitationStyleSlug,
  ): CitationFamily | 'unknown' {
    if (!style) {
      return 'unknown';
    }

    if (authorDateStyles.includes(style)) {
      return 'author-date';
    }

    if (numericStyles.includes(style)) {
      return 'numeric';
    }

    if (notesBibliographyStyles.includes(style)) {
      return 'notes-bibliography';
    }

    if (style === 'mla') {
      return 'mla';
    }

    return 'unknown';
  }
}
