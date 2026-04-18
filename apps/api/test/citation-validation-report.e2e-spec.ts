import { Test, TestingModule } from '@nestjs/testing';
import { CitationFormatValidatorService } from '../src/modules/citations/citation-format-validator.service';
import { CitationParserService } from '../src/modules/citations/citation-parser.service';
import { CitationValidationReportService } from '../src/modules/citations/citation-validation-report.service';

describe('CitationValidationReportService', () => {
  let parser: CitationParserService;
  let validator: CitationFormatValidatorService;
  let reportService: CitationValidationReportService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CitationParserService,
        CitationFormatValidatorService,
        CitationValidationReportService,
      ],
    }).compile();

    parser = module.get(CitationParserService);
    validator = module.get(CitationFormatValidatorService);
    reportService = module.get(CitationValidationReportService);
  });

  it('builds a discrepancy report grouped by entry and severity', () => {
    const bibliography = parser.parseBibliographyText(
      [
        'Smith, J., Doe, A. (2020). "Research methods in practice". Journal of Testing, 12(3), 45-67.',
        'Brown, C. (2021). Another study. Another Journal, 8(2), 11-20.',
      ].join('\n\n'),
      'apa-7',
    );

    const validation = validator.validateFormat(bibliography);
    const report = reportService.buildReport(validation);

    expect(report.style).toBe('apa-7');
    expect(report.family).toBe('author-date');
    expect(report.status).toBe('REVIEW_REQUIRED');
    expect(report.issueCount).toBe(validation.issues.length);
    expect(report.entryCount).toBe(2);
    expect(report.highlightedEntryIndexes).toEqual(expect.arrayContaining([0]));
    expect(report.entries[0]?.status).toBe('REVIEW');
    expect(report.entries[0]?.issues.some((issue) => issue.code === 'AUTHOR_DATE_TITLE_SHOULD_NOT_BE_QUOTED')).toBe(true);
    expect(report.recommendations.length).toBeGreaterThan(0);
  });
});
