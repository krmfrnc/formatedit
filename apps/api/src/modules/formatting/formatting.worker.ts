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

        const template = await this.prismaService.template.findUnique({
          where: { id: templateId },
        });

        if (!template) {
          throw new Error(`Template not found: ${templateId}`);
        }

        const templateParameters =
          template.templateParameters as unknown as Record<string, unknown>;

        const result = await this.formattingService.applyFormatting(
          documentId,
          documentVersionId,
          templateParameters,
        );

        if (!result.success) {
          appLogger.warn('Formatting job completed with errors', {
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

        const formattedVersionId = randomUUID();
        const docxBuffer = await this.docxOutputGeneratorService.generateDocx(
          result.formattedBlocks,
          this.resolveDocxGeneratorSettings(templateParameters),
        );
        const pdfBuffer = this.pdfOutputGeneratorService.generatePdf(
          result.formattedBlocks,
          this.resolveDocxGeneratorSettings(templateParameters),
        );

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
              blockCount: result.formattedBlocks.length,
              errors: result.errors,
              warnings: result.warnings,
              pdfStorageKey,
              pdfContentType: 'application/pdf',
              pdfSizeBytes: pdfBuffer.byteLength,
            } as unknown as Prisma.InputJsonValue,
          },
        });

        appLogger.info('Formatting job completed successfully', {
          documentId,
          documentVersionId,
          durationMs: result.durationMs,
          blockCount: result.formattedBlocks.length,
          docxStorageKey,
          pdfStorageKey,
        });
      },
    );
  }

  private resolveDocxGeneratorSettings(templateParameters: Record<string, unknown>): {
    fontFamily: string;
    fontSizePt: number;
  } {
    const typography = (templateParameters.typography ?? {}) as Record<
      string,
      unknown
    >;

    return {
      fontFamily:
        (typography.fontFamily as string) ?? 'Times New Roman',
      fontSizePt: (typography.fontSizePt as number) ?? 12,
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
