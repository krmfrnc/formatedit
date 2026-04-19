import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import type { Job, Worker } from 'bullmq';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { appLogger } from '../../common/logger';
import { QueueService } from '../queue/queue.service';
import type { QueueJobPayload } from '../queue/queue.types';
import { FormattingService } from './formatting.service';
import { PrismaService } from '../../prisma.service';
import { StorageService } from '../storage/storage.service';
import { DocxOutputGeneratorService } from './docx-output-generator.service';
import { PdfOutputGeneratorService } from './pdf-output-generator.service';
import type { WizardData } from './formatting.types';
import {
  defaultPageLayout,
  defaultTypography,
} from './formatting.constants';

@Injectable()
export class FormattingWorkerService implements OnModuleInit, OnModuleDestroy {
  private worker: Worker | null = null;

  constructor(
    private readonly queueService: QueueService,
    private readonly formattingService: FormattingService,
    private readonly prismaService: PrismaService,
    private readonly storageService: StorageService,
    private readonly docxOutputGeneratorService: DocxOutputGeneratorService,
    private readonly pdfOutputGeneratorService: PdfOutputGeneratorService,
  ) {}

  onModuleInit(): void {
    this.worker = this.queueService.createFormattingWorker(
      async (job: Job<QueueJobPayload>) => {
        const { documentId, documentVersionId, templateId, requestedBy } =
          job.data;

        if (!templateId) {
          throw new Error('Formatting job requires templateId');
        }

        if (!documentVersionId) {
          throw new Error('Formatting job requires documentVersionId');
        }

        appLogger.info('Processing formatting job', {
          jobId: job.id,
          documentId,
          documentVersionId,
          templateId,
          attempt: job.attemptsMade,
        });

        // 1. Load template
        const template = await this.prismaService.template.findUnique({
          where: { id: templateId },
        });

        if (!template) {
          throw new Error(`Template not found: ${templateId}`);
        }

        const templateParameters =
          template.templateParameters as unknown as Record<string, unknown>;

        // 2. Extract wizard data from job payload
        const wizardData = (job.data as unknown as Record<string, unknown>)
          .wizardData as WizardData | undefined;

        // 3. Run the formatting pipeline
        await job.updateProgress(10);

        const result = await this.formattingService.applyFormatting(
          documentId,
          documentVersionId,
          templateParameters,
          wizardData ?? {},
        );

        await job.updateProgress(50);

        if (!result.success) {
          appLogger.warn('Formatting pipeline completed with errors', {
            documentId,
            documentVersionId,
            errorCount: result.errors.length,
            warningCount: result.warnings.length,
          });

          if (result.errors.some((error) => error.severity === 'ERROR')) {
            throw new Error(
              `Formatting failed with ${result.errors.length} errors`,
            );
          }
        }

        // 4. Generate DOCX output
        const docxSettings = this.resolveDocxGeneratorSettings(templateParameters);

        const docxBuffer = await this.docxOutputGeneratorService.generateDocx(
          result.generatedPages,
          result.formattedBlocks,
          docxSettings,
        );

        await job.updateProgress(75);

        // 5. Generate PDF output
        const pdfBuffer = this.pdfOutputGeneratorService.generatePdf(
          [...result.generatedPages, ...result.formattedBlocks],
          {
            fontFamily: docxSettings.fontFamily,
            fontSizePt: docxSettings.fontSizePt,
          },
        );

        await job.updateProgress(85);

        // 6. Upload to storage
        const formattedVersionId = randomUUID();

        const docxStorageKey = this.buildFormattedStorageKey(
          documentId,
          formattedVersionId,
          'docx',
        );
        const pdfStorageKey = this.buildFormattedStorageKey(
          documentId,
          formattedVersionId,
          'pdf',
        );

        await this.storageService.uploadObject({
          key: docxStorageKey,
          body: docxBuffer,
          contentType:
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        });

        await this.storageService.uploadObject({
          key: pdfStorageKey,
          body: pdfBuffer,
          contentType: 'application/pdf',
        });

        await job.updateProgress(95);

        // 7. Create formatted version record
        await this.prismaService.documentVersion.create({
          data: {
            id: formattedVersionId,
            documentId,
            type: 'FORMATTED',
            label: `Formatted ${new Date().toISOString()}`,
            storageKey: docxStorageKey,
            contentType:
              'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            sizeBytes: docxBuffer.byteLength,
            metadata: {
              sourceVersionId: documentVersionId,
              templateId,
              formattedBy: requestedBy,
              durationMs: result.durationMs,
              contentBlockCount: result.formattedBlocks.length,
              generatedPageCount: result.generatedPages.length,
              errors: result.errors,
              warnings: result.warnings,
              infos: result.infos,
              pdfStorageKey,
              pdfContentType: 'application/pdf',
              pdfSizeBytes: pdfBuffer.byteLength,
            } as unknown as Prisma.InputJsonValue,
          },
        });

        await job.updateProgress(100);

        appLogger.info('Formatting job completed successfully', {
          documentId,
          documentVersionId,
          durationMs: result.durationMs,
          contentBlockCount: result.formattedBlocks.length,
          generatedPageCount: result.generatedPages.length,
          docxStorageKey,
          pdfStorageKey,
        });
      },
    );
  }

  private resolveDocxGeneratorSettings(
    templateParameters: Record<string, unknown>,
  ): {
    fontFamily: string;
    fontSizePt: number;
    pageLayout: {
      paperSize: string;
      orientation: 'portrait' | 'landscape';
      marginTopCm: number;
      marginBottomCm: number;
      marginLeftCm: number;
      marginRightCm: number;
      headerMarginCm: number;
      footerMarginCm: number;
      gutterCm: number;
    };
  } {
    const typography = (templateParameters.typography ?? {}) as Record<
      string,
      unknown
    >;
    const pageLayout = (templateParameters.pageLayout ?? {}) as Record<
      string,
      unknown
    >;

    return {
      fontFamily: (typography.fontFamily as string) ?? defaultTypography.fontFamily,
      fontSizePt: (typography.fontSizePt as number) ?? defaultTypography.fontSizePt,
      pageLayout: {
        paperSize: (pageLayout.paperSize as string) ?? defaultPageLayout.paperSize,
        orientation:
          (pageLayout.orientation as 'portrait' | 'landscape') ??
          defaultPageLayout.orientation,
        marginTopCm:
          (pageLayout.marginTopCm as number) ?? defaultPageLayout.marginTopCm,
        marginBottomCm:
          (pageLayout.marginBottomCm as number) ?? defaultPageLayout.marginBottomCm,
        marginLeftCm:
          (pageLayout.marginLeftCm as number) ?? defaultPageLayout.marginLeftCm,
        marginRightCm:
          (pageLayout.marginRightCm as number) ?? defaultPageLayout.marginRightCm,
        headerMarginCm:
          (pageLayout.headerMarginCm as number) ?? defaultPageLayout.headerMarginCm,
        footerMarginCm:
          (pageLayout.footerMarginCm as number) ?? defaultPageLayout.footerMarginCm,
        gutterCm: (pageLayout.gutterCm as number) ?? defaultPageLayout.gutterCm,
      },
    };
  }

  private buildFormattedStorageKey(
    documentId: string,
    versionId: string,
    extension: 'docx' | 'pdf',
  ): string {
    return `documents/${documentId}/formatted/${versionId}.${extension}`;
  }

  async onModuleDestroy(): Promise<void> {
    if (this.worker) {
      await this.worker.close();
      this.worker = null;
    }
  }
}
