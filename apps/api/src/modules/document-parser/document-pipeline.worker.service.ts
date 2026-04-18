import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import type { Worker } from 'bullmq';
import { appLogger } from '../../common/logger';
import { QueueService } from '../queue/queue.service';
import { StorageService } from '../storage/storage.service';
import { DocumentParserService } from './document-parser.service';
import { PdfConversionWorker } from './pdf-conversion.worker';

@Injectable()
export class DocumentPipelineWorkerService implements OnModuleInit, OnModuleDestroy {
  private worker: Worker | null = null;

  constructor(
    private readonly queueService: QueueService,
    private readonly storageService: StorageService,
    private readonly documentParserService: DocumentParserService,
    private readonly pdfConversionWorker: PdfConversionWorker,
  ) {}

  onModuleInit(): void {
    if (typeof this.queueService.createDocumentPipelineWorker !== 'function') {
      return;
    }

    this.worker = this.queueService.createDocumentPipelineWorker(async (job) => {
      if (job.data.stage === 'parse') {
        if (!job.data.storageKey || !job.data.documentVersionId) {
          throw new Error('Parse job requires storageKey and documentVersionId');
        }

        const sourceObject = await this.storageService.downloadObject(job.data.storageKey);
        await this.documentParserService.parseAndPersist(
          job.data.documentId,
          job.data.documentVersionId,
          sourceObject.body,
          job.data.requestedBy,
        );
        return;
      }

      if (job.data.stage === 'pdf-convert') {
        if (!job.data.documentVersionId) {
          throw new Error('PDF conversion job requires documentVersionId');
        }

        await this.pdfConversionWorker.processConversionJob({
          documentId: job.data.documentId,
          documentVersionId: job.data.documentVersionId,
          requestedBy: job.data.requestedBy,
          storageKey: job.data.storageKey,
        });
        return;
      }

      appLogger.info('Document pipeline worker skipped unsupported stage', {
        stage: job.data.stage,
        documentId: job.data.documentId,
      });
    });
  }

  async onModuleDestroy(): Promise<void> {
    if (this.worker) {
      await this.worker.close();
      this.worker = null;
    }
  }
}
