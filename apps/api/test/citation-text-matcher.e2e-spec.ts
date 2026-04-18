import { Test, TestingModule } from '@nestjs/testing';
import { CitationParserService } from '../src/modules/citations/citation-parser.service';
import { CitationTextMatcherService } from '../src/modules/citations/citation-text-matcher.service';

describe('CitationTextMatcherService', () => {
  let parser: CitationParserService;
  let matcher: CitationTextMatcherService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [CitationParserService, CitationTextMatcherService],
    }).compile();

    parser = module.get(CitationParserService);
    matcher = module.get(CitationTextMatcherService);
  });

  it('detects and matches author-date citations against bibliography entries', () => {
    const bibliography = parser.parseBibliographyText(
      [
        'Smith, J. (2020). Research methods in practice. Journal of Testing, 12(3), 45-67.',
        'Doe, A., & Brown, B. (2021). Follow-up study. Another Journal, 8(2), 11-20.',
      ].join('\n\n'),
      'apa-7',
    );

    const result = matcher.matchTextCitations({
      text: 'Recent work shows the effect (Smith, 2020, p. 12). A follow-up by Doe and Brown (2021) expands it.',
      bibliography,
    });

    expect(result.coverage.detectedCount).toBe(2);
    expect(result.coverage.matchedCount).toBe(2);
    expect(result.unmatchedBibliographyEntries).toHaveLength(0);
    expect(result.matches[0]?.matchedCitation?.authors[0]).toContain('Smith');
    expect(result.matches[1]?.matchedCitation?.authors[0]).toContain('Doe');
  });

  it('expands numeric ranges and matches bibliography order', () => {
    const bibliography = parser.parseBibliographyText(
      [
        '[1] J. Smith, A. Doe, "Efficient pipelines," IEEE Trans. Examples, vol. 12, no. 3, pp. 45-67, 2021.',
        '[2] A. Doe, J. Smith, "Another paper," J. Testing, vol. 8, no. 2, pp. 11-20, 2022.',
        '[3] M. Brown, "Third paper," J. Examples, vol. 5, no. 1, pp. 1-5, 2023.',
      ].join('\n'),
      'ieee',
    );

    const result = matcher.matchTextCitations({
      text: 'The pipeline appears in [1] and is extended in [2-3].',
      bibliography,
    });

    expect(result.coverage.detectedCount).toBe(3);
    expect(result.coverage.matchedCount).toBe(3);
    expect(result.matchedCitationIds).toHaveLength(3);
    expect(result.matches.map((item) => item.strategy)).toEqual([
      'numeric-order',
      'numeric-order',
      'numeric-order',
    ]);
  });

  it('reuses the previous match for notes markers', () => {
    const bibliography = parser.parseBibliographyText(
      [
        'Smith, John. Research Notes. Chicago Press, 2020.',
        'Doe, Jane. Further Notes. Chicago Press, 2021.',
      ].join('\n\n'),
      'chicago-notes-bibliography',
    );

    const result = matcher.matchTextCitations({
      text: 'Smith, John (2020) introduced the idea. Later, ibid. confirms the same source.',
      bibliography,
    });

    expect(result.coverage.detectedCount).toBe(2);
    expect(result.coverage.matchedCount).toBe(2);
    expect(result.matches[1]?.strategy).toBe('notes-reuse');
    expect(result.matches[1]?.matchedCitation?.orderIndex).toBe(result.matches[0]?.matchedCitation?.orderIndex);
  });
});
