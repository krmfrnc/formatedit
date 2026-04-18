import { Test, TestingModule } from '@nestjs/testing';
import { CitationParserService } from '../src/modules/citations/citation-parser.service';

describe('CitationParserService', () => {
  let service: CitationParserService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [CitationParserService],
    }).compile();

    service = module.get(CitationParserService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('parses author-date entries', () => {
    const result = service.parseCitationEntry(
      'Smith, J. (2020). Research methods in practice. Journal of Testing, 12(3), 45-67. https://doi.org/10.1234/example',
      'apa-7',
    );

    expect(result.authors).toContainEqual(expect.stringContaining('Smith'));
    expect(result.year).toBe(2020);
    expect(result.title).toContain('Research methods in practice');
    expect(result.doi).toContain('10.1234/example');
    expect(result.confidenceScore).toBeGreaterThan(0.5);
  });

  it('parses numeric entries', () => {
    const result = service.parseCitationEntry(
      '1. Smith J, Doe A. Efficient pipelines. IEEE Transactions on Examples. 2021;12(3):45-67.',
      'ieee',
    );

    expect(result.year).toBe(2021);
    expect(result.title).toContain('Efficient pipelines');
    expect(result.pages).toContain('45-67');
  });

  it('parses mla entries', () => {
    const result = service.parseCitationEntry(
      'Smith, John, and Jane Doe. "Human-centered design". Example Journal, vol. 12, no. 3, 2022, pp. 45-67.',
      'mla',
    );

    expect(result.year).toBe(2022);
    expect(result.title).toContain('Human-centered design');
    expect(result.containerTitle).toContain('Example Journal');
  });

  it('splits bibliography text into entries', () => {
    const result = service.parseBibliographyText(
      [
        'Smith, J. (2020). One title. Journal One, 1(1), 1-10.',
        'Doe, A. (2021). Second title. Journal Two, 2(2), 11-20.',
      ].join('\n\n'),
      'harvard',
    );

    expect(result.entries).toHaveLength(2);
    expect(result.family).toBe('author-date');
  });

  it('exposes supported styles', () => {
    expect(service.getSupportedStyles()).toContain('apa-7');
    expect(service.getSupportedStyles()).toContain('vancouver');
    expect(service.getSupportedStyles()).toContain('mla');
  });
});
