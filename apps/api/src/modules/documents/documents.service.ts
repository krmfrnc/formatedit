import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnsupportedMediaTypeException,
} from '@nestjs/common';
import { extname } from 'node:path';
import { randomUUID } from 'node:crypto';
import type { Prisma } from '@prisma/client';
import type {
  EditorBlockNumberingOverride,
  EditorCascadeNotification,
  EditorDocumentSettings,
  ParsedDocumentBlock,
} from '@formatedit/shared';
import { appLogger } from '../../common/logger';
import { AuditEventEmitterService } from '../audit/audit-event-emitter.service';
import { CitationFormatValidatorService } from '../citations/citation-format-validator.service';
import { CitationParserService } from '../citations/citation-parser.service';
import { CitationStyleDetectorService } from '../citations/citation-style-detector.service';
import { CitationValidationReportService } from '../citations/citation-validation-report.service';
import { DocumentParserService } from '../document-parser/document-parser.service';
import { QueueService } from '../queue/queue.service';
import { StorageService } from '../storage/storage.service';
import { PrismaService } from '../../prisma.service';
import { completeDocumentUploadSessionSchema } from './schemas/complete-document-upload-session.schema';
import { createDocumentUploadSessionSchema } from './schemas/create-document-upload-session.schema';
import { DocumentRateLimitService } from './document-rate-limit.service';
import { DocumentPreviewService } from './document-preview.service';
import { DocumentSecuritySettingsService } from './document-security-settings.service';
import { DocumentVirusScanService } from './document-virus-scan.service';
import { supportedUploadExtensions, supportedUploadMimeTypes } from './documents.constants';
import type {
  DocumentDetail,
  DocumentCitationValidationReport,
  DocumentListItem,
  DocumentSecurityPolicy,
  DocumentUploadResult,
  DocumentUploadSessionResult,
  DocumentVersionSummary,
} from './documents.types';

@Injectable()
export class DocumentsService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly storageService: StorageService,
    private readonly queueService: QueueService,
    private readonly documentParserService: DocumentParserService,
    private readonly documentSecuritySettingsService: DocumentSecuritySettingsService,
    private readonly documentVirusScanService: DocumentVirusScanService,
    private readonly documentPreviewService: DocumentPreviewService,
    private readonly documentRateLimitService: DocumentRateLimitService,
    private readonly citationStyleDetectorService: CitationStyleDetectorService,
    private readonly citationParserService: CitationParserService,
    private readonly citationFormatValidatorService: CitationFormatValidatorService,
    private readonly citationValidationReportService: CitationValidationReportService,
    private readonly auditEventEmitter: AuditEventEmitterService,
  ) {}

  async uploadDocument(userId: string, file: Express.Multer.File): Promise<DocumentUploadResult> {
    await this.documentRateLimitService.consume(userId, 'upload');
    if (!file) {
      throw new BadRequestException('A .docx document file is required');
    }

    const policy = await this.documentSecuritySettingsService.getPolicy();
    this.validateFileType(file.originalname, file.mimetype);
    this.validateFileSize(file.size, policy);

    const title = this.resolveTitle(file.originalname);
    const document = await this.prismaService.document.create({
      data: {
        userId,
        title,
        originalFileName: file.originalname,
        mimeType: file.mimetype,
        sizeBytes: file.size,
        currentScanStatus: 'PENDING',
        processingProgress: 10,
      },
    });

    // Single-write versioning: compute the storage key from a fresh UUID
    // (instead of the to-be-generated version id), upload to S3 first, then
    // insert a fully-populated DocumentVersion row. If the DB insert fails,
    // we delete the orphan S3 object so no unreferenced blob lingers.
    const storageKey = this.buildStorageKey(
      userId,
      document.id,
      randomUUID(),
      file.originalname,
      'raw',
    );

    await this.storageService.uploadObject({
      key: storageKey,
      body: file.buffer,
      contentType: file.mimetype,
    });

    let rawVersion;
    try {
      rawVersion = await this.prismaService.documentVersion.create({
        data: {
          documentId: document.id,
          type: 'RAW',
          label: 'Original upload',
          contentType: file.mimetype,
          sizeBytes: file.size,
          storageKey,
          metadata: {
            originalFileName: file.originalname,
          } as Prisma.InputJsonValue,
        },
      });
    } catch (error) {
      // DB row failed — roll back the S3 upload so we don't leak objects.
      try {
        await this.storageService.deleteObject(storageKey);
      } catch (deleteError) {
        appLogger.warn('Failed to delete orphan upload object', {
          documentId: document.id,
          storageKey,
          error: deleteError instanceof Error ? deleteError.message : String(deleteError),
        });
      }
      throw error;
    }

    await this.prismaService.document.update({
      where: { id: document.id },
      data: { processingProgress: 40 },
    });

    await this.queueService.enqueueVirusScanJob({
      documentId: document.id,
      documentVersionId: rawVersion.id,
      storageKey,
      stage: 'virus-scan',
      requestedBy: userId,
    });

    const scanOutcome = await this.documentVirusScanService.scanUpload(document.id, file.buffer);
    try {
      await this.documentParserService.parseAndPersist(document.id, rawVersion.id, file.buffer, userId);
    } catch (error) {
      appLogger.warn('Document upload completed with deferred parse retry', {
        documentId: document.id,
        documentVersionId: rawVersion.id,
        error: error instanceof Error ? error.message : 'Unknown parse error',
      });
    }
    await this.ensurePreviewVersion(document.id, userId);

    const currentProgress =
      scanOutcome.scanStatus === 'CLEAN' || scanOutcome.scanStatus === 'SKIPPED' ? 100 : 70;
    await this.prismaService.document.update({
      where: { id: document.id },
      data: {
        processingProgress: currentProgress,
      },
    });

    this.auditEventEmitter.emit({
      eventType: 'documents.uploaded',
      category: 'documents',
      actorUserId: userId,
      entityType: 'document',
      entityId: document.id,
      metadata: {
        storageKey,
        versionId: rawVersion.id,
        scanStatus: scanOutcome.scanStatus,
      },
    });

    return {
      documentId: document.id,
      versionId: rawVersion.id,
      title,
      originalFileName: file.originalname,
      mimeType: file.mimetype,
      sizeBytes: file.size,
      scanStatus: scanOutcome.scanStatus,
      storageKey,
      queueStage: 'virus-scan',
    };
  }

  async uploadDocuments(userId: string, files: Express.Multer.File[]): Promise<DocumentUploadResult[]> {
    if (!files.length) {
      throw new BadRequestException('At least one document file is required');
    }

    const results: DocumentUploadResult[] = [];
    for (const file of files) {
      results.push(await this.uploadDocument(userId, file));
    }

    return results;
  }

  async createUploadSession(
    userId: string,
    input: { fileName: string; mimeType: string; sizeBytes: number },
  ): Promise<DocumentUploadSessionResult> {
    await this.documentRateLimitService.consume(userId, 'upload');
    const payload = createDocumentUploadSessionSchema.parse(input);
    const policy = await this.documentSecuritySettingsService.getPolicy();
    this.validateFileType(payload.fileName, payload.mimeType);
    this.validateFileSize(payload.sizeBytes, policy);

    const session = await this.prismaService.documentUploadSession.create({
      data: {
        userId,
        fileName: payload.fileName,
        mimeType: payload.mimeType,
        sizeBytes: payload.sizeBytes,
        storageKey: `upload-sessions/${userId}/${Date.now()}-${payload.fileName}`,
        status: 'CREATED',
        progress: 5,
        expiresAt: new Date(Date.now() + 15 * 60 * 1000),
      },
    });

    const presigned = await this.storageService.createPresignedUploadUrl(
      session.storageKey,
      payload.mimeType,
      15 * 60,
    );

    return {
      sessionId: session.id,
      storageKey: session.storageKey,
      uploadUrl: presigned.url,
      expiresIn: presigned.expiresIn,
      status: session.status,
      progress: session.progress,
    };
  }

  async completeUploadSession(
    userId: string,
    input: { sessionId: string },
  ): Promise<DocumentUploadResult> {
    await this.documentRateLimitService.consume(userId, 'upload');
    const payload = completeDocumentUploadSessionSchema.parse(input);
    const session = await this.prismaService.documentUploadSession.findUnique({
      where: { id: payload.sessionId },
    });

    if (!session || session.userId !== userId) {
      throw new NotFoundException('Upload session was not found');
    }

    const document = await this.prismaService.document.create({
      data: {
        userId,
        title: this.resolveTitle(session.fileName),
        originalFileName: session.fileName,
        mimeType: session.mimeType,
        sizeBytes: session.sizeBytes,
        currentScanStatus: 'PENDING',
        processingProgress: 60,
      },
    });

    const rawVersion = await this.prismaService.documentVersion.create({
      data: {
        documentId: document.id,
        type: 'RAW',
        label: 'Original upload (session)',
        contentType: session.mimeType,
        sizeBytes: session.sizeBytes,
        storageKey: session.storageKey,
      },
    });

    await this.prismaService.documentUploadSession.update({
      where: { id: session.id },
      data: {
        status: 'COMPLETED',
        progress: 100,
        documentId: document.id,
      },
    });

    await this.queueService.enqueueVirusScanJob({
      documentId: document.id,
      documentVersionId: rawVersion.id,
      storageKey: session.storageKey,
      stage: 'virus-scan',
      requestedBy: userId,
    });

    await this.ensurePreviewVersion(document.id, userId);
    await this.queueService.enqueueParseJob({
      documentId: document.id,
      documentVersionId: rawVersion.id,
      storageKey: session.storageKey,
      stage: 'parse',
      requestedBy: userId,
    });

    this.auditEventEmitter.emit({
      eventType: 'documents.upload_session.completed',
      category: 'documents',
      actorUserId: userId,
      entityType: 'document_upload_session',
      entityId: session.id,
      metadata: {
        documentId: document.id,
      },
    });

    return {
      documentId: document.id,
      versionId: rawVersion.id,
      title: document.title,
      originalFileName: document.originalFileName,
      mimeType: document.mimeType,
      sizeBytes: document.sizeBytes,
      scanStatus: document.currentScanStatus,
      storageKey: session.storageKey,
      queueStage: 'virus-scan',
    };
  }

  async getUploadSession(userId: string, sessionId: string): Promise<DocumentUploadSessionResult> {
    await this.documentRateLimitService.consume(userId, 'api');
    const session = await this.prismaService.documentUploadSession.findUnique({
      where: { id: sessionId },
    });

    if (!session || session.userId !== userId) {
      throw new NotFoundException('Upload session was not found');
    }

    const presigned = await this.storageService.createPresignedUploadUrl(
      session.storageKey,
      session.mimeType,
      15 * 60,
    );

    return {
      sessionId: session.id,
      storageKey: session.storageKey,
      uploadUrl: presigned.url,
      expiresIn: presigned.expiresIn,
      status: session.status,
      progress: session.progress,
    };
  }

  async listDocuments(userId: string): Promise<DocumentListItem[]> {
    await this.documentRateLimitService.consume(userId, 'api');
    const documents = await this.prismaService.document.findMany({
      where: {
        userId,
        deletedAt: null,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return documents.map((document) => this.toDocumentListItem(document));
  }

  async getDocumentDetail(userId: string, documentId: string): Promise<DocumentDetail> {
    await this.documentRateLimitService.consume(userId, 'api');
    const document = await this.prismaService.document.findFirst({
      where: {
        id: documentId,
        userId,
      },
      include: {
        versions: {
          orderBy: {
            createdAt: 'desc',
          },
        },
      },
    });

    if (!document || document.deletedAt) {
      throw new NotFoundException('Document was not found');
    }

    return {
      ...this.toDocumentListItem(document),
      versions: document.versions.map((version) => this.toVersionSummary(version)),
    };
  }

  async getVersionHistory(userId: string, documentId: string): Promise<DocumentVersionSummary[]> {
    const detail = await this.getDocumentDetail(userId, documentId);
    return detail.versions;
  }

  async getEditorState(userId: string, documentId: string) {
    await this.documentRateLimitService.consume(userId, 'api');
    const document = await this.prismaService.document.findFirst({
      where: {
        id: documentId,
        userId,
      },
      include: {
        versions: {
          orderBy: {
            createdAt: 'desc',
          },
        },
      },
    });

    if (!document || document.deletedAt) {
      throw new NotFoundException('Document was not found');
    }

    const workingVersion = document.versions.find((entry) => entry.type === 'WORKING') ?? null;
    const sourceVersion =
      workingVersion ??
      document.versions.find((entry) => entry.type === 'RAW') ??
      document.versions[0] ??
      null;

    if (!sourceVersion) {
      throw new NotFoundException('Document version was not found');
    }

    return this.toEditorVersionState(documentId, sourceVersion.id, sourceVersion.type, sourceVersion.label);
  }

  async getPreviewState(userId: string, documentId: string) {
    await this.documentRateLimitService.consume(userId, 'api');
    await this.ensureOwnedDocument(userId, documentId);

    const preview = await this.documentPreviewService.getPreviewState(documentId);
    if (preview) {
      return preview;
    }

    const editorState = await this.getEditorState(userId, documentId);
    return this.documentPreviewService.renderAndPersistPreview(documentId, editorState.versionId);
  }

  async getCitationValidationReport(
    userId: string,
    documentId: string,
  ): Promise<DocumentCitationValidationReport> {
    await this.documentRateLimitService.consume(userId, 'api');
    const editorState = await this.getEditorState(userId, documentId);
    const citationBlocks = editorState.blocks.filter(
      (block) =>
        block.blockType === 'CITATION' ||
        (block.semanticSectionType === 'REFERENCES' && block.blockType !== 'HEADING'),
    );

    if (!citationBlocks.length) {
      return {
        documentId,
        versionId: editorState.versionId,
        detectedStyle: 'unknown',
        detectedFamily: 'unknown',
        confidenceScore: 0,
        citationBlockOrderIndexes: [],
        report: {
          style: 'unknown',
          family: 'unknown',
          status: 'COMPLIANT',
          issueCount: 0,
          errorCount: 0,
          warningCount: 0,
          infoCount: 0,
          entryCount: 0,
          entries: [],
          highlightedEntryIndexes: [],
          recommendations: [],
        },
      };
    }

    const bibliographyText = citationBlocks.map((block) => block.text.trim()).filter(Boolean).join('\n\n');
    const detection = await this.citationStyleDetectorService.detectFromEntries(
      citationBlocks.map((block) => block.text),
    );
    const resolvedStyle =
      detection.style !== 'unknown'
        ? detection.style
        : detection.candidates[0]?.style ?? null;

    if (!resolvedStyle) {
      return {
        documentId,
        versionId: editorState.versionId,
        detectedStyle: detection.style,
        detectedFamily: detection.family,
        confidenceScore: detection.confidenceScore,
        citationBlockOrderIndexes: citationBlocks.map((block) => block.orderIndex),
        report: {
          style: detection.style,
          family: detection.family,
          status: 'REVIEW_REQUIRED',
          issueCount: 0,
          errorCount: 0,
          warningCount: 0,
          infoCount: 0,
          entryCount: citationBlocks.length,
          entries: [],
          highlightedEntryIndexes: [],
          recommendations: ['Kaynakca stili otomatik olarak kesin belirlenemedi.'],
        },
      };
    }

    const parseResult = this.citationParserService.parseBibliographyText(
      bibliographyText,
      resolvedStyle,
    );
    const validationResult = this.citationFormatValidatorService.validateFormat(parseResult);
    const report = this.citationValidationReportService.buildReport(validationResult);

    return {
      documentId,
      versionId: editorState.versionId,
      detectedStyle: resolvedStyle,
      detectedFamily: detection.family,
      confidenceScore: detection.confidenceScore,
      citationBlockOrderIndexes: citationBlocks.map((block) => block.orderIndex),
      report,
    };
  }

  async updateWorkingVersion(
    userId: string,
    documentId: string,
    input: {
      blocks: Array<{
        blockType: string;
        semanticSectionType: string;
        title?: string | null;
        text: string;
        level?: number | null;
        numberingPattern?: string | null;
        numberingOverride?: EditorBlockNumberingOverride | null;
        manualSequenceNumber?: number | null;
      }>;
      label?: string;
      settings?: {
        pageNumbering?: Partial<EditorDocumentSettings['pageNumbering']>;
        sequence?: Partial<EditorDocumentSettings['sequence']>;
      };
      cascadeNotifications?: EditorCascadeNotification[];
    },
  ) {
    await this.documentRateLimitService.consume(userId, 'api');
    await this.ensureOwnedDocument(userId, documentId);

    const existing = await this.prismaService.documentVersion.findFirst({
      where: {
        documentId,
        type: 'WORKING',
      },
    });

    const blocks = input.blocks.map((block, index) => this.normalizeIncomingBlock(block, index));
    const settings = this.normalizeEditorSettings(input.settings);
    const cascadeNotifications = this.normalizeCascadeNotifications(input.cascadeNotifications);
    const metadata = {
      blocks,
      settings,
      cascadeNotifications,
      autosave: true,
      updatedAt: new Date().toISOString(),
    } as unknown as Prisma.InputJsonValue;

    const version = existing
      ? await this.prismaService.documentVersion.update({
          where: { id: existing.id },
          data: {
            label: input.label ?? 'Autosaved working version',
            metadata,
          },
        })
      : await this.prismaService.documentVersion.create({
          data: {
            documentId,
            type: 'WORKING',
            label: input.label ?? 'Autosaved working version',
            metadata,
          },
        });

    this.auditEventEmitter.emit({
      eventType: 'documents.working_version.updated',
      category: 'documents',
      actorUserId: userId,
      entityType: 'document_version',
      entityId: version.id,
      metadata: {
        documentId,
        blockCount: blocks.length,
        cascadeNotificationCount: cascadeNotifications.length,
      },
    });

    await this.documentPreviewService.renderAndPersistPreview(documentId, version.id);
    return this.toEditorVersionState(documentId, version.id, version.type, version.label);
  }

  async createSnapshot(userId: string, documentId: string, input: { label?: string }) {
    await this.documentRateLimitService.consume(userId, 'api');
    await this.ensureOwnedDocument(userId, documentId);

    const workingVersion = await this.prismaService.documentVersion.findFirst({
      where: {
        documentId,
        type: 'WORKING',
      },
    });

    const baseState = workingVersion
      ? await this.toEditorVersionState(documentId, workingVersion.id, workingVersion.type, workingVersion.label)
      : await this.getEditorState(userId, documentId);

    const snapshotVersion = await this.prismaService.documentVersion.create({
      data: {
        documentId,
        type: 'REVISION',
        label: input.label ?? `Manual snapshot ${new Date().toISOString()}`,
        metadata: {
          blocks: baseState.blocks,
          settings: baseState.settings,
          cascadeNotifications: baseState.cascadeNotifications,
          snapshotFromVersionId: baseState.versionId,
          createdAt: new Date().toISOString(),
        } as unknown as Prisma.InputJsonValue,
      },
    });

    this.auditEventEmitter.emit({
      eventType: 'documents.snapshot.created',
      category: 'documents',
      actorUserId: userId,
      entityType: 'document_version',
      entityId: snapshotVersion.id,
      metadata: {
        documentId,
        sourceVersionId: baseState.versionId,
      },
    });

    await this.documentPreviewService.renderAndPersistPreview(documentId, snapshotVersion.id);
    return this.toEditorVersionState(
      documentId,
      snapshotVersion.id,
      snapshotVersion.type,
      snapshotVersion.label,
    );
  }

  async getVersionDiff(userId: string, documentId: string, versionId: string, compareVersionId: string) {
    await this.documentRateLimitService.consume(userId, 'api');
    await this.ensureOwnedDocument(userId, documentId);

    const base = await this.getVersionBlocks(documentId, versionId);
    const compare = await this.getVersionBlocks(documentId, compareVersionId);

    const maxLength = Math.max(base.blocks.length, compare.blocks.length);
    const changes: Array<{
      orderIndex: number;
      changeType: 'added' | 'removed' | 'updated';
      beforeText: string | null;
      afterText: string | null;
      blockType: string;
    }> = [];

    for (let index = 0; index < maxLength; index += 1) {
      const left = base.blocks[index] ?? null;
      const right = compare.blocks[index] ?? null;

      if (!left && right) {
        changes.push({
          orderIndex: index,
          changeType: 'added',
          beforeText: null,
          afterText: right.text,
          blockType: right.blockType,
        });
        continue;
      }

      if (left && !right) {
        changes.push({
          orderIndex: index,
          changeType: 'removed',
          beforeText: left.text,
          afterText: null,
          blockType: left.blockType,
        });
        continue;
      }

      if (left && right && (left.text !== right.text || left.blockType !== right.blockType || left.title !== right.title)) {
        changes.push({
          orderIndex: index,
          changeType: 'updated',
          beforeText: left.text,
          afterText: right.text,
          blockType: right.blockType,
        });
      }
    }

    return {
      baseVersionId: versionId,
      compareVersionId,
      changes,
    };
  }

  async restoreVersion(userId: string, documentId: string, versionId: string) {
    await this.documentRateLimitService.consume(userId, 'api');
    await this.ensureOwnedDocument(userId, documentId);

    const source = await this.getVersionBlocks(documentId, versionId);
    const restored = await this.prismaService.documentVersion.create({
      data: {
        documentId,
        type: 'REVISION',
        label: `Restored from ${versionId}`,
        metadata: {
          blocks: source.blocks,
          settings: source.settings,
          cascadeNotifications: source.cascadeNotifications,
          restoredFromVersionId: versionId,
          restoredAt: new Date().toISOString(),
        } as unknown as Prisma.InputJsonValue,
      },
    });

    this.auditEventEmitter.emit({
      eventType: 'documents.version.restored',
      category: 'documents',
      actorUserId: userId,
      entityType: 'document_version',
      entityId: restored.id,
      metadata: {
        documentId,
        restoredFromVersionId: versionId,
      },
    });

    await this.documentPreviewService.renderAndPersistPreview(documentId, restored.id);
    return this.toEditorVersionState(documentId, restored.id, restored.type, restored.label);
  }

  async softDeleteDocument(userId: string, documentId: string): Promise<{ success: true }> {
    await this.documentRateLimitService.consume(userId, 'api');
    const document = await this.prismaService.document.findFirst({
      where: {
        id: documentId,
        userId,
      },
    });

    if (!document || document.deletedAt) {
      throw new NotFoundException('Document was not found');
    }

    await this.prismaService.document.update({
      where: { id: documentId },
      data: {
        deletedAt: new Date(),
        processingProgress: 100,
      },
    });

    await this.prismaService.documentVersion.create({
      data: {
        documentId,
        type: 'ARCHIVE',
        label: 'Document archived after delete',
        metadata: {
          deletedByUserId: userId,
        } as Prisma.InputJsonValue,
      },
    });

    this.auditEventEmitter.emit({
      eventType: 'documents.deleted',
      category: 'documents',
      actorUserId: userId,
      entityType: 'document',
      entityId: documentId,
    });

    return { success: true };
  }

  async createVersionPresignedDownloadUrl(userId: string, documentId: string, versionId: string) {
    await this.documentRateLimitService.consume(userId, 'download');
    const document = await this.prismaService.document.findFirst({
      where: {
        id: documentId,
        userId,
      },
      include: {
        versions: true,
      },
    });

    if (!document || document.deletedAt) {
      throw new NotFoundException('Document was not found');
    }

    const version = document.versions.find((entry) => entry.id === versionId);
    if (!version?.storageKey) {
      throw new NotFoundException('Downloadable version was not found');
    }

    return this.storageService.createPresignedDownloadUrl(version.storageKey);
  }

  async getFinalDownloadUrl(userId: string, documentId: string) {
    await this.documentRateLimitService.consume(userId, 'download');
    const document = await this.prismaService.document.findFirst({
      where: {
        id: documentId,
        userId,
      },
      include: {
        versions: {
          orderBy: {
            createdAt: 'desc',
          },
        },
      },
    });

    if (!document || document.deletedAt) {
      throw new NotFoundException('Document was not found');
    }

    const finalVersion = document.versions.find((entry) => entry.type === 'FINAL' && entry.storageKey);
    if (!finalVersion?.storageKey) {
      throw new NotFoundException('Final version is not ready');
    }

    return this.storageService.createPresignedDownloadUrl(finalVersion.storageKey);
  }

  getSecurityPolicy(): Promise<DocumentSecurityPolicy> {
    return this.documentSecuritySettingsService.getPolicy();
  }

  async updateSecurityPolicy(policy: DocumentSecurityPolicy): Promise<DocumentSecurityPolicy> {
    const updated = await this.documentSecuritySettingsService.updatePolicy(policy);

    this.auditEventEmitter.emit({
      eventType: 'documents.security.updated',
      category: 'documents',
      actorType: 'SYSTEM',
      entityType: 'document_security_setting',
      entityId: 'default',
      metadata: updated as unknown as Record<string, unknown>,
    });

    return updated;
  }

  private async ensurePreviewVersion(documentId: string, userId: string): Promise<void> {
    await this.queueService.enqueueDocumentPipelineJob({
      documentId,
      stage: 'preview',
      requestedBy: userId,
    });

    const latestRawVersion = await this.prismaService.documentVersion.findFirst({
      where: {
        documentId,
        type: 'RAW',
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    if (latestRawVersion) {
      try {
        await this.documentPreviewService.renderAndPersistPreview(documentId, latestRawVersion.id);
      } catch (error) {
        appLogger.warn('Preview render deferred until parsed blocks are available', {
          documentId,
          documentVersionId: latestRawVersion.id,
          error: error instanceof Error ? error.message : 'Unknown preview error',
        });
      }
    }
  }

  private validateFileType(fileName: string, mimeType: string): void {
    const extension = extname(fileName).toLowerCase();
    if (!supportedUploadExtensions.includes(extension as (typeof supportedUploadExtensions)[number])) {
      throw new UnsupportedMediaTypeException('Only .docx uploads are supported');
    }

    if (!supportedUploadMimeTypes.includes(mimeType as (typeof supportedUploadMimeTypes)[number])) {
      throw new UnsupportedMediaTypeException('Unsupported document MIME type');
    }
  }

  private validateFileSize(sizeBytes: number, policy: DocumentSecurityPolicy): void {
    if (sizeBytes > policy.maxUploadSizeBytes) {
      throw new BadRequestException(`Document exceeds max upload size of ${policy.maxUploadSizeBytes} bytes`);
    }
  }

  private buildStorageKey(
    userId: string,
    documentId: string,
    versionId: string,
    originalFileName: string,
    versionFolder: 'raw' | 'preview' | 'final',
  ): string {
    return `documents/${userId}/${documentId}/${versionFolder}/${versionId}${extname(originalFileName).toLowerCase()}`;
  }

  private resolveTitle(originalFileName: string): string {
    return originalFileName.replace(/\.[^.]+$/, '');
  }

  private async ensureOwnedDocument(userId: string, documentId: string) {
    const document = await this.prismaService.document.findFirst({
      where: {
        id: documentId,
        userId,
      },
    });

    if (!document || document.deletedAt) {
      throw new NotFoundException('Document was not found');
    }

    return document;
  }

  private async getVersionBlocks(documentId: string, versionId: string): Promise<{
    versionId: string;
    blocks: ParsedDocumentBlock[];
    settings: EditorDocumentSettings;
    cascadeNotifications: EditorCascadeNotification[];
  }> {
    const version = await this.prismaService.documentVersion.findUnique({
      where: { id: versionId },
    });

    if (!version || version.documentId !== documentId) {
      throw new NotFoundException('Document version was not found');
    }

    const metadata = (version.metadata ?? {}) as Record<string, unknown>;
    const metadataBlocks = metadata.blocks as ParsedDocumentBlock[] | undefined;
    const settings = this.normalizeEditorSettings(
      metadata.settings as Partial<EditorDocumentSettings> | undefined,
    );
    const cascadeNotifications = this.normalizeCascadeNotifications(
      metadata.cascadeNotifications as EditorCascadeNotification[] | undefined,
    );
    if (Array.isArray(metadataBlocks) && metadataBlocks.length) {
      return {
        versionId: version.id,
        blocks: metadataBlocks.map((block, index) => this.normalizeIncomingBlock(block, index)),
        settings,
        cascadeNotifications,
      };
    }

    const sections = await this.prismaService.documentSection.findMany({
      where: {
        documentId,
        documentVersionId: version.id,
      },
      orderBy: [{ orderIndex: 'asc' }, { createdAt: 'asc' }],
    });

    if (!sections.length) {
      throw new NotFoundException('Version blocks are not available');
    }

    return {
      versionId: version.id,
      blocks: sections.map((section, index) => {
        const content = (section.content ?? {}) as Record<string, unknown>;
        return this.normalizeIncomingBlock(
          {
            blockType: section.sectionType,
            semanticSectionType: (content.semanticSectionType as string | undefined) ?? 'BODY',
            title: section.title,
            text: (content.text as string | undefined) ?? section.title ?? '',
          },
          index,
        );
      }),
      settings,
      cascadeNotifications,
    };
  }

  private async toEditorVersionState(
    documentId: string,
    versionId: string,
    type: 'RAW' | 'WORKING' | 'FORMATTED' | 'REVISION' | 'PREVIEW' | 'FINAL' | 'ARCHIVE',
    label: string | null,
  ) {
    const versionBlocks = await this.getVersionBlocks(documentId, versionId);
    return {
      versionId,
      type,
      label,
      blocks: versionBlocks.blocks,
      settings: versionBlocks.settings,
      cascadeNotifications: versionBlocks.cascadeNotifications,
      updatedAt: new Date().toISOString(),
    };
  }

  private normalizeIncomingBlock(
    block: {
      blockType: string;
      semanticSectionType: string;
      title?: string | null;
      text: string;
      level?: number | null;
      numberingPattern?: string | null;
      numberingOverride?: EditorBlockNumberingOverride | null;
      manualSequenceNumber?: number | null;
    },
    index: number,
  ): ParsedDocumentBlock {
    const blockType = (block.blockType || 'PARAGRAPH') as ParsedDocumentBlock['blockType'];
    const isHeading = blockType === 'HEADING';

    return {
      orderIndex: index,
      blockType,
      semanticSectionType: (block.semanticSectionType || 'BODY') as ParsedDocumentBlock['semanticSectionType'],
      title: block.title ?? null,
      text: block.text.trim(),
      level: isHeading ? block.level ?? 1 : null,
      confidenceScore: 0.95,
      numberingPattern: block.numberingPattern ?? null,
      lineLengthScore: block.text.length <= 120 ? 1 : 0.65,
      hasCitation: /\([A-Z][A-Za-z-]+,\s*(19|20)\d{2}\)/.test(block.text),
      hasFootnote: false,
      hasEquation: /=/.test(block.text),
      tableOrFigureLabel: null,
      templateSlot: null,
      numberingOverride: block.numberingOverride ?? null,
      manualSequenceNumber: block.manualSequenceNumber ?? null,
    };
  }

  private normalizeEditorSettings(
    settings?: {
      pageNumbering?: Partial<EditorDocumentSettings['pageNumbering']>;
      sequence?: Partial<EditorDocumentSettings['sequence']>;
    },
  ): EditorDocumentSettings {
    return {
      pageNumbering: {
        frontMatterStyle: settings?.pageNumbering?.frontMatterStyle ?? 'roman',
        bodyStyle: settings?.pageNumbering?.bodyStyle ?? 'arabic',
        bodyStartPage: settings?.pageNumbering?.bodyStartPage ?? 1,
        bodyStartNumber: settings?.pageNumbering?.bodyStartNumber ?? 1,
        unnumberedPages: [...(settings?.pageNumbering?.unnumberedPages ?? [])]
          .filter((page) => Number.isInteger(page) && page > 0)
          .sort((left, right) => left - right),
      },
      sequence: {
        tableStart: settings?.sequence?.tableStart ?? 1,
        figureStart: settings?.sequence?.figureStart ?? 1,
        equationStart: settings?.sequence?.equationStart ?? 1,
      },
    };
  }

  private normalizeCascadeNotifications(
    notifications?: EditorCascadeNotification[],
  ): EditorCascadeNotification[] {
    if (!Array.isArray(notifications)) {
      return [];
    }

    return notifications
      .filter((notification) => notification?.id && notification?.message)
      .map((notification) => ({
        id: notification.id,
        type: notification.type,
        severity: notification.severity,
        message: notification.message,
      }));
  }

  private toDocumentListItem(document: {
    id: string;
    title: string;
    originalFileName: string;
    mimeType: string;
    sizeBytes: number;
    currentScanStatus: 'PENDING' | 'CLEAN' | 'INFECTED' | 'FAILED' | 'SKIPPED';
    processingProgress: number;
    createdAt: Date;
    deletedAt: Date | null;
  }): DocumentListItem {
    return {
      id: document.id,
      title: document.title,
      originalFileName: document.originalFileName,
      mimeType: document.mimeType,
      sizeBytes: document.sizeBytes,
      currentScanStatus: document.currentScanStatus,
      processingProgress: document.processingProgress,
      createdAt: document.createdAt.toISOString(),
      deletedAt: document.deletedAt?.toISOString() ?? null,
    };
  }

  private toVersionSummary(version: {
    id: string;
    type: 'RAW' | 'WORKING' | 'FORMATTED' | 'REVISION' | 'PREVIEW' | 'FINAL' | 'ARCHIVE';
    label: string | null;
    storageKey: string | null;
    contentType: string | null;
    sizeBytes: number | null;
    createdAt: Date;
  }): DocumentVersionSummary {
    return {
      id: version.id,
      type: version.type,
      label: version.label,
      storageKey: version.storageKey,
      contentType: version.contentType,
      sizeBytes: version.sizeBytes,
      createdAt: version.createdAt.toISOString(),
    };
  }
}
