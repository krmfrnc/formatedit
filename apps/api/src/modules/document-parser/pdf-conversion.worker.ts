import { Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { promises as fs } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { Prisma } from '@prisma/client';
import { appLogger } from '../../common/logger';
import { PrismaService } from '../../prisma.service';
import { QueueService } from '../queue/queue.service';
import { StorageService } from '../storage/storage.service';

const execFileAsync = promisify(execFile);

/**
 * Circuit breaker for LibreOffice conversion. If the binary fails (or times
 * out) {@link CIRCUIT_FAILURE_THRESHOLD} times in a row, we stop invoking it
 * for {@link CIRCUIT_COOL_DOWN_MS} and short-circuit the job — the queue can
 * retry later. This protects the worker from thrashing on a sick soffice.
 */
const CIRCUIT_FAILURE_THRESHOLD = 5;
const CIRCUIT_COOL_DOWN_MS = 60_000;

@Injectable()
export class PdfConversionWorker {
  private consecutiveFailures = 0;
  private circuitOpenedAt: number | null = null;

  constructor(
    private readonly prismaService: PrismaService,
    private readonly storageService: StorageService,
    private readonly queueService: QueueService,
    private readonly configService: ConfigService,
  ) {}

  private ensureCircuitClosed(): void {
    if (this.circuitOpenedAt === null) {
      return;
    }
    if (Date.now() - this.circuitOpenedAt >= CIRCUIT_COOL_DOWN_MS) {
      // Cool-down elapsed — half-open: let the next call try again.
      this.circuitOpenedAt = null;
      this.consecutiveFailures = 0;
      return;
    }
    throw new InternalServerErrorException(
      'PDF conversion temporarily unavailable — LibreOffice circuit breaker is open',
    );
  }

  private recordSuccess(): void {
    this.consecutiveFailures = 0;
    this.circuitOpenedAt = null;
  }

  private recordFailure(): void {
    this.consecutiveFailures += 1;
    if (this.consecutiveFailures >= CIRCUIT_FAILURE_THRESHOLD) {
      this.circuitOpenedAt = Date.now();
      appLogger.error('PDF conversion circuit breaker opened', {
        consecutiveFailures: this.consecutiveFailures,
        coolDownMs: CIRCUIT_COOL_DOWN_MS,
      });
    }
  }

  async processConversionJob(input: {
    documentId: string;
    documentVersionId: string;
    requestedBy: string;
    storageKey?: string;
  }): Promise<{ convertedVersionId: string; lowConfidence: true }> {
    const version = await this.prismaService.documentVersion.findUnique({
      where: { id: input.documentVersionId },
    });

    if (!version || version.documentId !== input.documentId) {
      throw new NotFoundException('Document version for PDF conversion was not found');
    }

    const sourceStorageKey = input.storageKey ?? version.storageKey;
    if (!sourceStorageKey) {
      throw new InternalServerErrorException('PDF conversion source file is missing');
    }

    const sourceObject = await this.storageService.downloadObject(sourceStorageKey);
    if (!this.looksLikePdf(version.contentType, sourceObject.contentType, sourceStorageKey)) {
      await this.markSkipped(input.documentId, input.documentVersionId, 'Source file is not a PDF');
      throw new InternalServerErrorException('PDF conversion requires a PDF source version');
    }

    this.ensureCircuitClosed();

    let conversion: Buffer;
    try {
      conversion = await this.runLibreOfficeConversion(sourceObject.body, sourceStorageKey);
      this.recordSuccess();
    } catch (error) {
      this.recordFailure();
      throw error;
    }

    // Single-write versioning: upload to S3 first, then insert the row with
    // storageKey already populated. If the DB insert fails we delete the
    // orphan S3 object so conversion retries stay idempotent.
    const storageKey = `documents/${input.requestedBy}/${input.documentId}/raw/${randomUUID()}.docx`;
    await this.storageService.uploadObject({
      key: storageKey,
      body: conversion,
      contentType:
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    });

    let convertedVersion;
    try {
      convertedVersion = await this.prismaService.documentVersion.create({
        data: {
          documentId: input.documentId,
          type: 'RAW',
          label: 'PDF converted DOCX',
          contentType:
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          sizeBytes: conversion.byteLength,
          storageKey,
          metadata: {
            parseSource: 'pdf-conversion',
            conversionEngine: 'libreoffice-headless',
            lowConfidence: true,
            conversionStatus: 'COMPLETED',
            sourceVersionId: input.documentVersionId,
          } as Prisma.InputJsonValue,
        },
      });
    } catch (error) {
      try {
        await this.storageService.deleteObject(storageKey);
      } catch (deleteError) {
        appLogger.warn('Failed to delete orphan converted DOCX', {
          storageKey,
          error: deleteError instanceof Error ? deleteError.message : String(deleteError),
        });
      }
      throw error;
    }

    await this.prismaService.documentVersion.update({
      where: { id: input.documentVersionId },
      data: {
        metadata: {
          parseSource: 'pdf-conversion',
          conversionEngine: 'libreoffice-headless',
          lowConfidence: true,
          conversionStatus: 'COMPLETED',
          convertedVersionId: convertedVersion.id,
        } as Prisma.InputJsonValue,
      },
    });

    await this.prismaService.document.update({
      where: { id: input.documentId },
      data: {
        processingProgress: 80,
      },
    });

    await this.queueService.enqueueParseJob({
      documentId: input.documentId,
      documentVersionId: convertedVersion.id,
      requestedBy: input.requestedBy,
      storageKey,
      stage: 'parse',
    });

    appLogger.info('PDF conversion completed and parse queued', {
      documentId: input.documentId,
      sourceVersionId: input.documentVersionId,
      convertedVersionId: convertedVersion.id,
      storageKey,
      worker: 'pdf-conversion',
    });

    return {
      convertedVersionId: convertedVersion.id,
      lowConfidence: true,
    };
  }

  private async runLibreOfficeConversion(buffer: Buffer, sourceStorageKey: string): Promise<Buffer> {
    const binary = this.configService.get<string>('libreOfficeBinary', 'soffice');
    const timeout = this.configService.get<number>('pdfConversionTimeoutMs', 60000);
    const workdir = join(tmpdir(), `formatedit-pdf-convert-${randomUUID()}`);

    await fs.mkdir(workdir, { recursive: true });

    const inputPath = join(workdir, `${basename(sourceStorageKey, '.pdf') || 'source'}.pdf`);
    const outputPath = join(workdir, `${basename(inputPath, '.pdf')}.docx`);

    try {
      await fs.writeFile(inputPath, buffer);
      await execFileAsync(
        binary,
        [
          '--headless',
          '--convert-to',
          'docx:"MS Word 2007 XML"',
          '--outdir',
          workdir,
          inputPath,
        ],
        {
          timeout,
        },
      );

      return await fs.readFile(outputPath);
    } catch (error) {
      appLogger.error('PDF conversion failed', {
        binary,
        sourceStorageKey,
        error: error instanceof Error ? error.message : 'Unknown conversion error',
      });

      throw new InternalServerErrorException(
        `PDF conversion failed. Ensure ${binary} is installed and reachable.`,
      );
    } finally {
      await fs.rm(workdir, { recursive: true, force: true });
    }
  }

  private looksLikePdf(
    versionContentType: string | null,
    storageContentType: string | null,
    storageKey: string,
  ): boolean {
    return (
      versionContentType === 'application/pdf' ||
      storageContentType === 'application/pdf' ||
      storageKey.toLowerCase().endsWith('.pdf')
    );
  }

  private async markSkipped(
    documentId: string,
    documentVersionId: string,
    reason: string,
  ): Promise<void> {
    await this.prismaService.documentVersion.update({
      where: { id: documentVersionId },
      data: {
        metadata: {
          parseSource: 'pdf-conversion',
          conversionEngine: 'libreoffice-headless',
          lowConfidence: true,
          conversionStatus: 'SKIPPED',
          lastFailure: reason,
        } as Prisma.InputJsonValue,
      },
    });

    appLogger.warn('PDF conversion skipped', {
      documentId,
      documentVersionId,
      reason,
    });
  }
}
