import { CitationTextMatcherService } from '../src/modules/citations/citation-text-matcher.service';
import { CitationTextUpdateService } from '../src/modules/citations/citation-text-update.service';
import type { CitationParseResult, ParsedCitation } from '../src/modules/citations/citation.types';

describe('CitationTextUpdateService', () => {
  const matcher = new CitationTextMatcherService();
  const service = new CitationTextUpdateService(matcher);

  const bibliographyEntries: ParsedCitation[] = [
    {
      orderIndex: 0,
      style: 'apa-7',
      family: 'author-date',
      rawText:
        'Smith, John A. (2020). Testing conversion one. Journal One, 1(1), 1-10.',
      authors: ['Smith, John A.'],
      year: 2020,
      title: 'Testing conversion one',
      containerTitle: 'Journal One',
      volume: '1',
      issue: '1',
      pages: '1-10',
      publisher: null,
      doi: null,
      url: null,
      note: null,
      confidenceScore: 0.95,
      normalizedText:
        'Smith, John A. (2020) Testing conversion one Journal One 1(1) 1-10',
    },
    {
      orderIndex: 1,
      style: 'apa-7',
      family: 'author-date',
      rawText:
        'Doe, Jane. (2021). Testing conversion two. Journal Two, 2(2), 11-20.',
      authors: ['Doe, Jane'],
      year: 2021,
      title: 'Testing conversion two',
      containerTitle: 'Journal Two',
      volume: '2',
      issue: '2',
      pages: '11-20',
      publisher: null,
      doi: null,
      url: null,
      note: null,
      confidenceScore: 0.95,
      normalizedText:
        'Doe, Jane (2021) Testing conversion two Journal Two 2(2) 11-20',
    },
    {
      orderIndex: 2,
      style: 'apa-7',
      family: 'author-date',
      rawText:
        'Brown, Alex. (2022). Testing conversion three. Journal Three, 3(3), 21-30.',
      authors: ['Brown, Alex'],
      year: 2022,
      title: 'Testing conversion three',
      containerTitle: 'Journal Three',
      volume: '3',
      issue: '3',
      pages: '21-30',
      publisher: null,
      doi: null,
      url: null,
      note: null,
      confidenceScore: 0.95,
      normalizedText:
        'Brown, Alex (2022) Testing conversion three Journal Three 3(3) 21-30',
    },
  ];

  const bibliography: CitationParseResult = {
    style: 'apa-7',
    family: 'author-date',
    entries: bibliographyEntries,
  };

  it('updates author-date citations into numeric citations', () => {
    const result = service.updateTextCitations({
      text: 'Smith (2020) argues this. The counterpoint appears (Doe, 2021, pp. 11-12).',
      bibliography,
      targetStyle: 'vancouver',
    });

    expect(result.updatedText).toContain('[1]');
    expect(result.updatedText).toContain('[2, pp. 11-12]');
    expect(result.updatedCount).toBe(2);
    expect(result.unmatchedCount).toBe(0);
    expect(result.approximate).toBe(false);
  });

  it('updates numeric citations into author-date citations', () => {
    const numericBibliography: CitationParseResult = {
      style: 'ieee',
      family: 'numeric',
      entries: bibliographyEntries,
    };

    const result = service.updateTextCitations({
      text: 'The findings appear in [1] and [2-3].',
      bibliography: numericBibliography,
      targetStyle: 'apa-7',
    });

    expect(result.updatedText).toContain('(Smith, 2020)');
    expect(result.updatedText).toContain('(Doe, 2021); (Brown, 2022)');
    expect(result.updatedCount).toBe(2);
    expect(result.unmatchedCount).toBe(0);
  });

  it('preserves unmatched citations and reports a warning', () => {
    const result = service.updateTextCitations({
      text: 'An unlinked citation appears here (Unknown, 2024).',
      bibliography,
      targetStyle: 'mla',
    });

    expect(result.updatedText).toBe('An unlinked citation appears here (Unknown, 2024).');
    expect(result.unmatchedCount).toBe(1);
    expect(result.warningCount).toBeGreaterThan(0);
  });
});
