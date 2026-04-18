import { CitationParserService } from '../src/modules/citations/citation-parser.service';
import { CitationStyleConversionService } from '../src/modules/citations/citation-style-conversion.service';
import type { CitationParseResult, ParsedCitation } from '../src/modules/citations/citation.types';

describe('CitationStyleConversionService preview', () => {
  const parser = new CitationParserService();
  const service = new CitationStyleConversionService(parser);

  const entries: ParsedCitation[] = [
    {
      orderIndex: 0,
      style: 'apa-7',
      family: 'author-date',
      rawText: 'Smith, John A. (2020). Testing conversion one. Journal One, 1(1), 1-10.',
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
      normalizedText: 'Smith, John A. (2020) Testing conversion one Journal One 1(1) 1-10',
    },
    {
      orderIndex: 1,
      style: 'apa-7',
      family: 'author-date',
      rawText: 'Doe, Jane. (2021). Testing conversion two. Journal Two, 2(2), 11-20.',
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
      normalizedText: 'Doe, Jane (2021) Testing conversion two Journal Two 2(2) 11-20',
    },
    {
      orderIndex: 2,
      style: 'apa-7',
      family: 'author-date',
      rawText: 'Brown, Alex. (2022). Testing conversion three. Journal Three, 3(3), 21-30.',
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
      normalizedText: 'Brown, Alex (2022) Testing conversion three Journal Three 3(3) 21-30',
    },
    {
      orderIndex: 3,
      style: 'apa-7',
      family: 'author-date',
      rawText: 'Taylor, Sam. (2023). Testing conversion four. Journal Four, 4(4), 31-40.',
      authors: ['Taylor, Sam'],
      year: 2023,
      title: 'Testing conversion four',
      containerTitle: 'Journal Four',
      volume: '4',
      issue: '4',
      pages: '31-40',
      publisher: null,
      doi: null,
      url: null,
      note: null,
      confidenceScore: 0.95,
      normalizedText: 'Taylor, Sam (2023) Testing conversion four Journal Four 4(4) 31-40',
    },
  ];

  const bibliography: CitationParseResult = {
    style: 'apa-7',
    family: 'author-date',
    entries,
  };

  it('returns three sample entries and a truncated preview summary', () => {
    const preview = service.previewBibliography(bibliography, 'vancouver');

    expect(preview.totalEntries).toBe(4);
    expect(preview.sampleSize).toBe(3);
    expect(preview.truncated).toBe(true);
    expect(preview.previewEntries).toHaveLength(3);
    expect(preview.previewEntries[0].previewIndex).toBe(0);
    expect(preview.previewEntries[2].previewIndex).toBe(2);
    expect(preview.previewText).toContain('1.');
    expect(preview.summary).toContain('ilk 3 tanesi gösteriliyor');
  });

  it('shows a complete preview when the bibliography fits in the sample size', () => {
    const preview = service.previewBibliography(
      {
        style: 'apa-7',
        family: 'author-date',
        entries: entries.slice(0, 2),
      },
      'mla',
    );

    expect(preview.totalEntries).toBe(2);
    expect(preview.truncated).toBe(false);
    expect(preview.previewEntries).toHaveLength(2);
    expect(preview.summary).toContain('2 kaynak dönüştürme sonrası böyle görünecek');
  });
});
