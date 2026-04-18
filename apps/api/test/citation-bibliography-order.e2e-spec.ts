import { CitationBibliographyOrderService } from '../src/modules/citations/citation-bibliography-order.service';
import type { CitationParseResult, ParsedCitation } from '../src/modules/citations/citation.types';

function createEntry(
  orderIndex: number,
  overrides: Partial<ParsedCitation> = {},
): ParsedCitation {
  return {
    orderIndex,
    style: 'apa-7',
    family: 'author-date',
    rawText: `Entry ${orderIndex}`,
    authors: [`Author ${orderIndex}`],
    year: 2020 + orderIndex,
    title: `Title ${orderIndex}`,
    containerTitle: null,
    volume: null,
    issue: null,
    pages: null,
    publisher: null,
    doi: null,
    url: null,
    note: null,
    confidenceScore: 0.98,
    normalizedText: `entry ${orderIndex}`,
    ...overrides,
  };
}

describe('CitationBibliographyOrderService', () => {
  const service = new CitationBibliographyOrderService();

  it('sorts bibliography alphabetically by author/title and keeps metadata', () => {
    const bibliography: CitationParseResult = {
      style: 'apa-7',
      family: 'author-date',
      entries: [
        createEntry(2, {
          rawText: 'Zeus, A. (2022). Zeta study.',
          authors: ['Zeus, A.'],
          title: 'Zeta study',
          year: 2022,
        }),
        createEntry(0, {
          rawText: 'Adams, B. (2021). Alpha study.',
          authors: ['Adams, B.'],
          title: 'Alpha study',
          year: 2021,
        }),
        createEntry(1, {
          rawText: 'Adams, B. (2020). Beta study.',
          authors: ['Adams, B.'],
          title: 'Beta study',
          year: 2020,
        }),
      ],
    };

    const result = service.sortBibliography({
      bibliography,
      orderMode: 'alphabetical',
    });

    expect(result.sourceStyle).toBe('apa-7');
    expect(result.sourceFamily).toBe('author-date');
    expect(result.entryCount).toBe(3);
    expect(result.movedCount).toBe(2);
    expect(result.entries.map((entry) => entry.rawText)).toEqual([
      'Adams, B. (2020). Beta study.',
      'Adams, B. (2021). Alpha study.',
      'Zeus, A. (2022). Zeta study.',
    ]);
    expect(result.entries.map((entry) => entry.originalOrderIndex)).toEqual([1, 0, 2]);
    expect(result.entries.map((entry) => entry.sortedOrderIndex)).toEqual([0, 1, 2]);
    expect(result.bibliographyText).toContain('Adams, B. (2020). Beta study.');
  });

  it('sorts bibliography by citation order and falls back deterministically', () => {
    const bibliography: CitationParseResult = {
      style: 'vancouver',
      family: 'numeric',
      entries: [
        createEntry(3, {
          rawText: '[3] Third entry.',
          authors: ['Third, T.'],
          title: 'Third entry',
          year: 2023,
        }),
        createEntry(1, {
          rawText: '[1] First entry.',
          authors: ['First, F.'],
          title: 'First entry',
          year: 2021,
        }),
        createEntry(2, {
          rawText: '[2] Second entry.',
          authors: ['Second, S.'],
          title: 'Second entry',
          year: 2022,
        }),
      ],
    };

    const result = service.sortBibliography({
      bibliography,
      orderMode: 'citation-order',
    });

    expect(result.sourceStyle).toBe('vancouver');
    expect(result.sourceFamily).toBe('numeric');
    expect(result.entryCount).toBe(3);
    expect(result.movedCount).toBe(3);
    expect(result.entries.map((entry) => entry.rawText)).toEqual([
      '[1] First entry.',
      '[2] Second entry.',
      '[3] Third entry.',
    ]);
    expect(result.entries.map((entry) => entry.orderIndex)).toEqual([0, 1, 2]);
    expect(result.entries.every((entry) => entry.sortKey.length > 0)).toBe(true);
  });

  it('accepts raw parsed entry arrays with explicit bibliography style', () => {
    const result = service.sortBibliography({
      bibliography: [
        createEntry(0, {
          rawText: 'Smith, J. (2024). Zed.',
          authors: ['Smith, J.'],
          title: 'Zed',
          year: 2024,
        }),
        createEntry(1, {
          rawText: 'Anderson, A. (2023). Alpha.',
          authors: ['Anderson, A.'],
          title: 'Alpha',
          year: 2023,
        }),
      ],
      bibliographyStyle: 'mla',
      orderMode: 'alphabetical',
    });

    expect(result.sourceStyle).toBe('mla');
    expect(result.sourceFamily).toBe('mla');
    expect(result.entries[0]?.rawText).toBe('Anderson, A. (2023). Alpha.');
  });
});
