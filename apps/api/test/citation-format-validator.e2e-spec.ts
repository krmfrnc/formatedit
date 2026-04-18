import { Test, TestingModule } from '@nestjs/testing';
import { CitationFormatValidatorService } from '../src/modules/citations/citation-format-validator.service';
import { CitationParserService } from '../src/modules/citations/citation-parser.service';

describe('CitationFormatValidatorService', () => {
  let parser: CitationParserService;
  let validator: CitationFormatValidatorService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [CitationParserService, CitationFormatValidatorService],
    }).compile();

    parser = module.get(CitationParserService);
    validator = module.get(CitationFormatValidatorService);
  });

  it('validates APA style and flags missing ampersands and quotes', () => {
    const bibliography = parser.parseBibliographyText(
      [
        'Smith, J., Doe, A. (2020). "Research methods in practice". Journal of Testing, 12(3), 45-67.',
        'Brown, C. (2021). Another study. Another Journal, 8(2), 11-20.',
      ].join('\n\n'),
      'apa-7',
    );

    const result = validator.validateFormat(bibliography);

    expect(result.style).toBe('apa-7');
    expect(result.family).toBe('author-date');
    expect(result.isValid).toBe(true);
    expect(result.issues.some((issue) => issue.code === 'AUTHOR_DATE_CONNECTOR_SHOULD_USE_AMPERSAND')).toBe(true);
    expect(result.issues.some((issue) => issue.code === 'AUTHOR_DATE_TITLE_SHOULD_NOT_BE_QUOTED')).toBe(true);
    expect(result.summaries).toHaveLength(2);
  });

  it('validates numeric style and requires numeric markers', () => {
    const bibliography = parser.parseBibliographyText(
      [
        '[1] J. Smith, A. Doe, "Efficient pipelines," IEEE Trans. Examples, vol. 12, no. 3, pp. 45-67, 2021.',
        'A. Doe, J. Smith, "Another paper," J. Testing, vol. 8, no. 2, pp. 11-20, 2022.',
      ].join('\n'),
      'ieee',
    );

    const result = validator.validateFormat(bibliography);

    expect(result.style).toBe('ieee');
    expect(result.family).toBe('numeric');
    expect(result.issues.some((issue) => issue.code === 'NUMERIC_BIBLIOGRAPHY_MARKER_REQUIRED')).toBe(true);
    expect(result.issues.some((issue) => issue.code === 'NUMERIC_AUTHOR_INITIALS_RECOMMENDED')).toBe(false);
  });

  it('validates notes-bibliography style and warns about note markers', () => {
    const bibliography = parser.parseBibliographyText(
      [
        'Smith, John. Research Notes. Chicago Press, 2020.',
        'Doe, Jane. Further Notes. Chicago Press, 2021.',
      ].join('\n\n'),
      'chicago-notes-bibliography',
    );

    const result = validator.validateFormat(bibliography);

    expect(result.style).toBe('chicago-notes-bibliography');
    expect(result.family).toBe('notes-bibliography');
    expect(result.issues.some((issue) => issue.code === 'NOTES_DOI_OR_URL_RECOMMENDED')).toBe(true);
    expect(result.issues.some((issue) => issue.code === 'NOTES_MARKER_SHOULD_NOT_APPEAR_IN_BIBLIOGRAPHY')).toBe(false);
  });

  it('validates MLA style and keeps year optional', () => {
    const bibliography = parser.parseBibliographyText(
      [
        'Smith, John, and Jane Doe. "Human-centered design". Example Journal, vol. 12, no. 3, 45-67.',
        'Miller, Anna. A book chapter. Press House, 2019.',
      ].join('\n\n'),
      'mla',
    );

    const result = validator.validateFormat(bibliography);

    expect(result.style).toBe('mla');
    expect(result.family).toBe('mla');
    expect(result.issues.some((issue) => issue.code === 'MLA_YEAR_IS_OPTIONAL')).toBe(true);
    expect(result.isValid).toBe(true);
  });
});
