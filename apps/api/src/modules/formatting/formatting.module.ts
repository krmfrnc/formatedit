import { Module } from '@nestjs/common';
import { QueueModule } from '../queue/queue.module';
import { StorageModule } from '../storage/storage.module';
import { FormattingService } from './formatting.service';
import { PageLayoutApplierService } from './page-layout-applier.service';
import { TypographyApplierService } from './typography-applier.service';
import { HeadingStyleApplierService } from './heading-style-applier.service';
import { PageNumberingApplierService } from './page-numbering-applier.service';
import { CoverPageGeneratorService } from './cover-page-generator.service';
import { ApprovalPageGeneratorService } from './approval-page-generator.service';
import { DeclarationGeneratorService } from './declaration-generator.service';
import { AbstractPageGeneratorService } from './abstract-page-generator.service';
import { TableOfContentsGeneratorService } from './table-of-contents-generator.service';
import { TableListGeneratorService } from './table-list-generator.service';
import { FigureListGeneratorService } from './figure-list-generator.service';
import { AbbreviationsGeneratorService } from './abbreviations-generator.service';
import { CVGeneratorService } from './cv-generator.service';
import { SectionOrderApplierService } from './section-order-applier.service';
import { SequenceNumberingApplierService } from './sequence-numbering-applier.service';
import { CrossReferenceUpdaterService } from './cross-reference-updater.service';
import { ValidationCheckerService } from './validation-checker.service';
import { DocxOutputGeneratorService } from './docx-output-generator.service';
import { PdfOutputGeneratorService } from './pdf-output-generator.service';
import { FormattingQueueService } from './formatting.queue.service';
import { FormattingWorkerService } from './formatting.worker';

@Module({
  imports: [QueueModule, StorageModule],
  providers: [
    FormattingService,
    PageLayoutApplierService,
    TypographyApplierService,
    HeadingStyleApplierService,
    PageNumberingApplierService,
    CoverPageGeneratorService,
    ApprovalPageGeneratorService,
    DeclarationGeneratorService,
    AbstractPageGeneratorService,
    TableOfContentsGeneratorService,
    TableListGeneratorService,
    FigureListGeneratorService,
    AbbreviationsGeneratorService,
    CVGeneratorService,
    SectionOrderApplierService,
    SequenceNumberingApplierService,
    CrossReferenceUpdaterService,
    ValidationCheckerService,
    DocxOutputGeneratorService,
    PdfOutputGeneratorService,
    FormattingQueueService,
    FormattingWorkerService,
  ],
  exports: [
    FormattingService,
    PageLayoutApplierService,
    TypographyApplierService,
    HeadingStyleApplierService,
    PageNumberingApplierService,
    CoverPageGeneratorService,
    ApprovalPageGeneratorService,
    DeclarationGeneratorService,
    AbstractPageGeneratorService,
    TableOfContentsGeneratorService,
    TableListGeneratorService,
    FigureListGeneratorService,
    AbbreviationsGeneratorService,
    CVGeneratorService,
    SectionOrderApplierService,
    SequenceNumberingApplierService,
    CrossReferenceUpdaterService,
    ValidationCheckerService,
    DocxOutputGeneratorService,
    PdfOutputGeneratorService,
    FormattingQueueService,
    FormattingWorkerService,
  ],
})
export class FormattingModule {}
