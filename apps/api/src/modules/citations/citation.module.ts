import { Module } from '@nestjs/common';
import { CitationAiStyleDetectorService } from './citation-ai-style-detector.service';
import { CitationBibliographyOrderService } from './citation-bibliography-order.service';
import { CitationFormatValidatorService } from './citation-format-validator.service';
import { CitationParserService } from './citation-parser.service';
import { CitationStyleConversionService } from './citation-style-conversion.service';
import { CitationTextUpdateService } from './citation-text-update.service';
import { CitationValidationReportService } from './citation-validation-report.service';
import { CitationTextMatcherService } from './citation-text-matcher.service';
import { CitationStyleDetectorService } from './citation-style-detector.service';

@Module({
  providers: [
    CitationParserService,
    CitationStyleConversionService,
    CitationTextUpdateService,
    CitationTextMatcherService,
    CitationBibliographyOrderService,
    CitationFormatValidatorService,
    CitationValidationReportService,
    CitationStyleDetectorService,
    CitationAiStyleDetectorService,
  ],
  exports: [
    CitationParserService,
    CitationStyleConversionService,
    CitationTextUpdateService,
    CitationTextMatcherService,
    CitationBibliographyOrderService,
    CitationFormatValidatorService,
    CitationValidationReportService,
    CitationStyleDetectorService,
    CitationAiStyleDetectorService,
  ],
})
export class CitationModule {}
