import { CitationParserService } from '../src/modules/citations/citation-parser.service';
import { CitationStyleConversionService } from '../src/modules/citations/citation-style-conversion.service';
import type { CitationParseResult, ParsedCitation } from '../src/modules/citations/citation.types';

describe('CitationStyleConversionService', () => {
  const parser = new CitationParserService();
  const service = new CitationStyleConversionService(parser);

  const completeEntry: ParsedCitation = {
    orderIndex: 0,
    style: 'apa-7',
    family: 'author-date',
    rawText:
      'Smith, John A., & Doe, Jane. (2020). Testing conversion. Journal of Things, 12(3), 45-67. https://doi.org/10.1000/test',
    authors: ['Smith, John A.', 'Doe, Jane'],
    year: 2020,
    title: 'Testing conversion',
    containerTitle: 'Journal of Things',
    volume: '12',
    issue: '3',
    pages: '45-67',
    publisher: null,
    doi: '10.1000/test',
    url: null,
    note: null,
    confidenceScore: 0.97,
    normalizedText:
      'Smith, John A.; Doe, Jane (2020) Testing conversion Journal of Things 12(3) 45-67 doi:10.1000/test',
  };

  const completeBibliography: CitationParseResult = {
    style: 'apa-7',
    family: 'author-date',
    entries: [completeEntry],
  };

  const numericEntry: ParsedCitation = {
    ...completeEntry,
    orderIndex: 0,
    style: 'ieee',
    family: 'numeric',
    rawText:
      '[1] Smith, John A., Doe, Jane. Testing conversion. Journal of Things. 2020;12(3):45-67. https://doi.org/10.1000/test',
  };

  it('converts author-date bibliography into numeric output', () => {
    const result = service.convertBibliography(completeBibliography, 'vancouver');

    expect(result.sourceStyle).toBe('apa-7');
    expect(result.targetStyle).toBe('vancouver');
    expect(result.targetFamily).toBe('numeric');
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0].convertedText).toMatch(/^1\./);
    expect(result.entries[0].convertedText).toContain('2020');
    expect(result.entries[0].segments.some((segment) => segment.kind === 'prefix')).toBe(true);
    expect(result.warningCount).toBe(0);
    expect(result.approximate).toBe(false);
  });

  it('converts numeric bibliography into mla output with quoted titles', () => {
    const bibliography: CitationParseResult = {
      style: 'ieee',
      family: 'numeric',
      entries: [numericEntry],
    };

    const result = service.convertBibliography(bibliography, 'mla');

    expect(result.sourceStyle).toBe('ieee');
    expect(result.targetStyle).toBe('mla');
    expect(result.mode).toBe('cross-family');
    expect(result.entries[0].convertedText).toContain('“Testing conversion.”');
    expect(result.entries[0].convertedText).toContain('vol. 12');
    expect(result.entries[0].convertedText).toContain('pp. 45-67');
    expect(result.entries[0].segments.find((segment) => segment.kind === 'title')?.quoted).toBe(true);
  });

  it('marks incomplete entries as approximate and keeps warnings', () => {
    const incompleteBibliography: CitationParseResult = {
      style: 'apa-7',
      family: 'author-date',
      entries: [
        {
          ...completeEntry,
          title: null,
          year: null,
          containerTitle: null,
          publisher: null,
          doi: null,
          url: null,
          rawText: 'Smith, John A.',
          confidenceScore: 0.5,
        },
      ],
    };

    const result = service.convertBibliography(incompleteBibliography, 'harvard');

    expect(result.entries[0].approximate).toBe(true);
    expect(result.entries[0].warnings.some((warning) => warning.code === 'CITATION_CONVERSION_TITLE_MISSING')).toBe(true);
    expect(result.warningCount).toBeGreaterThan(0);
  });

  it('parses raw bibliography text before converting it', () => {
    const result = service.convertBibliographyText(
      'Smith, John A., & Doe, Jane. (2020). Testing conversion. Journal of Things, 12(3), 45-67. https://doi.org/10.1000/test',
      'apa-7',
      'ieee',
    );

    expect(result.entries).toHaveLength(1);
    expect(result.entries[0].convertedText).toContain('[1]');
    expect(result.entries[0].convertedText).toContain('Testing conversion');
    expect(result.entries[0].segments.some((segment) => segment.kind === 'locator')).toBe(true);
  });
});
