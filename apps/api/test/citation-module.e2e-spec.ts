import { ConfigModule } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { CitationBibliographyOrderService } from '../src/modules/citations/citation-bibliography-order.service';
import { CitationFormatValidatorService } from '../src/modules/citations/citation-format-validator.service';
import { CitationModule } from '../src/modules/citations/citation.module';
import { CitationParserService } from '../src/modules/citations/citation-parser.service';
import { CitationStyleConversionService } from '../src/modules/citations/citation-style-conversion.service';
import { CitationStyleDetectorService } from '../src/modules/citations/citation-style-detector.service';
import { CitationTextMatcherService } from '../src/modules/citations/citation-text-matcher.service';
import { CitationTextUpdateService } from '../src/modules/citations/citation-text-update.service';
import { CitationValidationReportService } from '../src/modules/citations/citation-validation-report.service';

describe('CitationModule', () => {
  let module: TestingModule;
  let parser: CitationParserService;
  let detector: CitationStyleDetectorService;
  let validator: CitationFormatValidatorService;
  let reportService: CitationValidationReportService;
  let conversionService: CitationStyleConversionService;
  let matcher: CitationTextMatcherService;
  let updateService: CitationTextUpdateService;
  let orderService: CitationBibliographyOrderService;

  beforeEach(async () => {
    module = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          ignoreEnvFile: true,
          load: [
            () => ({
              citationAiEnabled: 'false',
              citationAiProvider: 'openai',
              citationAiBaseUrl: 'https://api.openai.test/v1',
              citationAiModel: 'gpt-4o-mini',
              citationAiApiKey: 'test-key',
              citationAiTimeoutMs: 15000,
            }),
          ],
        }),
        CitationModule,
      ],
    }).compile();

    parser = module.get(CitationParserService);
    detector = module.get(CitationStyleDetectorService);
    validator = module.get(CitationFormatValidatorService);
    reportService = module.get(CitationValidationReportService);
    conversionService = module.get(CitationStyleConversionService);
    matcher = module.get(CitationTextMatcherService);
    updateService = module.get(CitationTextUpdateService);
    orderService = module.get(CitationBibliographyOrderService);
  });

  it('resolves the citation services exported by the module', () => {
    expect(parser).toBeInstanceOf(CitationParserService);
    expect(detector).toBeInstanceOf(CitationStyleDetectorService);
    expect(validator).toBeInstanceOf(CitationFormatValidatorService);
    expect(reportService).toBeInstanceOf(CitationValidationReportService);
    expect(conversionService).toBeInstanceOf(CitationStyleConversionService);
    expect(matcher).toBeInstanceOf(CitationTextMatcherService);
    expect(updateService).toBeInstanceOf(CitationTextUpdateService);
    expect(orderService).toBeInstanceOf(CitationBibliographyOrderService);
  });

  it('runs a bibliography and in-text citation workflow end-to-end through the module', async () => {
    const bibliographyText = [
      'Smith, J. (2020). Research methods in practice. Journal of Testing, 12(3), 45-67. https://doi.org/10.1234/example',
      'Adams, B. (2021). Applied workflow design. Systems Journal, 8(2), 11-20. https://doi.org/10.1234/second',
    ].join('\n\n');
    const parsed = parser.parseBibliographyText(bibliographyText, 'apa-7');

    const detected = await detector.detectCitationStyle(bibliographyText);
    const validation = validator.validateFormat(parsed);
    const report = reportService.buildReport(validation);
    const ordered = orderService.sortBibliography({
      bibliography: parsed,
      orderMode: 'alphabetical',
    });
    const preview = conversionService.previewBibliography(parsed, 'vancouver');
    const matched = matcher.matchTextCitations({
      text: 'As Smith (2020) argues, the method is reproducible.',
      bibliography: parsed,
    });
    const updated = updateService.previewTextCitationUpdates({
      text: 'As Smith (2020) argues, the method is reproducible.',
      bibliography: parsed,
      targetStyle: 'vancouver',
    });

    expect(detected.style).toBe('apa-7');
    expect(detected.family).toBe('author-date');
    expect(validation.isValid).toBe(true);
    expect(report.status).toBe('COMPLIANT');
    expect(report.highlightedEntryIndexes).toHaveLength(0);
    expect(ordered.entries.map((entry) => entry.authors[0])).toEqual([
      'Adams, B.',
      'Smith, J.',
    ]);
    expect(preview.targetStyle).toBe('vancouver');
    expect(preview.previewEntries).toHaveLength(2);
    expect(matched.detectedCitations.length).toBeGreaterThan(0);
    expect(matched.coverage.matchedCount).toBeGreaterThan(0);
    expect(updated.targetStyle).toBe('vancouver');
    expect(updated.changes.length).toBeGreaterThan(0);
    expect(updated.updatedText).not.toBe('As Smith (2020) argues, the method is reproducible.');
  });
});
