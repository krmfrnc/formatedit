import type {
  DocumentScanStatus,
  DocumentUploadSessionStatus,
  DocumentVersionType,
} from '@prisma/client';
import type {
  DocumentCitationValidationReport as SharedDocumentCitationValidationReport,
  ParsedDocumentBlock,
} from '@formatedit/shared';

export interface DocumentUploadResult {
  documentId: string;
  versionId: string;
  title: string;
  originalFileName: string;
  mimeType: string;
  sizeBytes: number;
  scanStatus: DocumentScanStatus;
  storageKey: string;
  queueStage: 'virus-scan';
}

export interface VirusScanProviderResult {
  provider: 'clamav' | 'virustotal';
  status: 'clean' | 'infected' | 'skipped' | 'failed';
  detail: string;
}

export interface DocumentSecurityPolicy {
  maxUploadSizeBytes: number;
  clamAvEnabled: boolean;
  virusTotalEnabled: boolean;
}

export interface DocumentVersionSummary {
  id: string;
  type: DocumentVersionType;
  label: string | null;
  storageKey: string | null;
  contentType: string | null;
  sizeBytes: number | null;
  createdAt: string;
}

export interface DocumentListItem {
  id: string;
  title: string;
  originalFileName: string;
  mimeType: string;
  sizeBytes: number;
  currentScanStatus: DocumentScanStatus;
  processingProgress: number;
  createdAt: string;
  deletedAt: string | null;
}

export interface DocumentDetail extends DocumentListItem {
  versions: DocumentVersionSummary[];
}

export interface DocumentUploadSessionResult {
  sessionId: string;
  storageKey: string;
  uploadUrl: string;
  expiresIn: number;
  status: DocumentUploadSessionStatus;
  progress: number;
}

export interface DocumentEditorVersionState {
  versionId: string;
  type: DocumentVersionType;
  label: string | null;
  blocks: ParsedDocumentBlock[];
  updatedAt: string;
}

export interface DocumentVersionDiffEntry {
  orderIndex: number;
  changeType: 'added' | 'removed' | 'updated';
  beforeText: string | null;
  afterText: string | null;
  blockType: string;
}

export interface DocumentVersionDiffResult {
  baseVersionId: string;
  compareVersionId: string;
  changes: DocumentVersionDiffEntry[];
}

export type DocumentCitationValidationReport = SharedDocumentCitationValidationReport;
