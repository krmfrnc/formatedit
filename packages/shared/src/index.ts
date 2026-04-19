export type AppEnvironment = 'development' | 'test' | 'production';

export type UserRole = 'USER' | 'ADMIN' | 'EXPERT' | 'SUPER_ADMIN';

export type AcademicTitle =
  | 'UNDERGRADUATE'
  | 'MASTERS_STUDENT'
  | 'DOCTORAL_STUDENT'
  | 'RESEARCH_ASSISTANT'
  | 'LECTURER'
  | 'ASSISTANT_PROFESSOR'
  | 'ASSOCIATE_PROFESSOR'
  | 'PROFESSOR'
  | 'OTHER';

export type ThemePreference = 'SYSTEM' | 'LIGHT' | 'DARK';
export type AuditActorType = 'USER' | 'SYSTEM';
export type AuditExportFormat = 'csv' | 'excel';
export type CitationFamily = 'author-date' | 'numeric' | 'notes-bibliography' | 'mla' | 'unknown';
export type CitationStyleSlug =
  | 'apa-7'
  | 'apa-6'
  | 'vancouver'
  | 'ieee'
  | 'mdpi'
  | 'chicago-author-date'
  | 'chicago-notes-bibliography'
  | 'harvard'
  | 'mla'
  | 'ama'
  | 'nlm';

export interface CitationInfo {
  raw: string;
  style: CitationStyleSlug | 'unknown';
  authors?: string[];
  year?: string;
  page?: string;
}

export interface AppConfigShape {
  nodeEnv: AppEnvironment;
  appUrl: string;
  apiUrl: string;
}

export interface HealthStatus {
  status: 'ok';
  timestamp: string;
}

export interface RegisteredUser {
  id: string;
  email: string;
  role: UserRole;
  academicTitle: AcademicTitle;
  createdAt: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresIn: string;
  refreshTokenExpiresIn: string;
}

export interface AuthSession {
  user: RegisteredUser;
  tokens: AuthTokens;
}

export interface NotificationPreferences {
  emailEnabled: boolean;
  inAppEnabled: boolean;
  whatsappEnabled: boolean;
  telegramEnabled: boolean;
}

export interface UserProfile extends RegisteredUser {
  fullName: string | null;
  preferredLanguage: string;
  themePreference: ThemePreference;
  notificationPreferences: NotificationPreferences;
}

export interface ImpersonationHistoryEntry {
  id: string;
  adminId: string;
  startedAt: string;
  endedAt: string | null;
  reason: string;
}

export interface AuditLogRecord {
  id: string;
  eventType: string;
  category: string;
  actorType: AuditActorType;
  actorUserId: string | null;
  actorRole: UserRole | null;
  entityType: string | null;
  entityId: string | null;
  targetUserId: string | null;
  route: string | null;
  method: string | null;
  statusCode: number | null;
  ipAddress: string | null;
  userAgent: string | null;
  requestId: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

export interface AuditRetentionPolicy {
  retentionDays: number;
  isEnabled: boolean;
}

export interface DocumentUploadSummary {
  documentId: string;
  versionId: string;
  title: string;
  originalFileName: string;
  mimeType: string;
  sizeBytes: number;
  scanStatus: 'PENDING' | 'CLEAN' | 'INFECTED' | 'FAILED' | 'SKIPPED';
  storageKey: string;
  queueStage: 'virus-scan';
}

export interface DocumentSecuritySettings {
  maxUploadSizeBytes: number;
  clamAvEnabled: boolean;
  virusTotalEnabled: boolean;
}

export type BackupCadence = 'DAILY' | 'WEEKLY' | 'MONTHLY';
export type BackupMode = 'FULL' | 'INCREMENTAL';
export type LegalDocumentSlug = 'TERMS' | 'PRIVACY' | 'KVKK' | 'GDPR' | 'COOKIES';

export interface BackupSettings {
  cadence: BackupCadence;
  mode: BackupMode;
  retentionDays: number;
}

export interface SupportedLanguage {
  code: string;
  label: string;
}

export interface AdminSystemSettingsSnapshot {
  backup: BackupSettings | null;
  languages: SupportedLanguage[];
  documentSecurity: DocumentSecuritySettings;
}

export interface LegalDocumentPageRecord {
  id: string;
  slug: LegalDocumentSlug;
  locale: string;
  title: string;
  content: string;
  version: number;
  publishedAt: string | null;
  isActive: boolean;
  updatedAt: string;
}

export interface DocumentListItem {
  id: string;
  title: string;
  originalFileName: string;
  mimeType: string;
  sizeBytes: number;
  currentScanStatus: 'PENDING' | 'CLEAN' | 'INFECTED' | 'FAILED' | 'SKIPPED';
  processingProgress: number;
  createdAt: string;
  deletedAt: string | null;
}

export interface DocumentVersionRecord {
  id: string;
  type: 'RAW' | 'WORKING' | 'FORMATTED' | 'REVISION' | 'PREVIEW' | 'FINAL' | 'ARCHIVE';
  label: string | null;
  storageKey: string | null;
  contentType: string | null;
  sizeBytes: number | null;
  createdAt: string;
}

export interface DocumentDetail extends DocumentListItem {
  versions: DocumentVersionRecord[];
}

export interface EditorDocumentVersionState {
  versionId: string;
  type: 'RAW' | 'WORKING' | 'FORMATTED' | 'REVISION' | 'PREVIEW' | 'FINAL' | 'ARCHIVE';
  label: string | null;
  blocks: ParsedDocumentBlock[];
  settings: EditorDocumentSettings;
  cascadeNotifications: EditorCascadeNotification[];
  updatedAt: string;
}

export interface DocumentVersionDiff {
  baseVersionId: string;
  compareVersionId: string;
  changes: Array<{
    orderIndex: number;
    changeType: 'added' | 'removed' | 'updated';
    beforeText: string | null;
    afterText: string | null;
    blockType: string;
  }>;
}

export interface DocumentPreviewBlock {
  orderIndex: number;
  blockType: ParsedDocumentBlock['blockType'];
  title: string | null;
  text: string;
  displayText: string;
}

export interface DocumentPreviewState {
  documentId: string;
  sourceVersionId: string;
  previewVersionId: string;
  status: 'queued' | 'ready';
  updatedAt: string;
  blocks: DocumentPreviewBlock[];
}

export interface DocumentPreviewUpdatedEvent {
  documentId: string;
  preview: DocumentPreviewState;
}

export interface TemplateParameterSet {
  pageLayout: Record<string, unknown>;
  typography: Record<string, unknown>;
  headingHierarchy: Record<string, unknown>;
  pageNumbering: Record<string, unknown>;
  coverPages: Record<string, unknown>;
  fixedPages: Record<string, unknown>;
  sectionOrdering: Record<string, unknown>;
  tableFigureFormatting: Record<string, unknown>;
  equationFormatting: Record<string, unknown>;
  citations: Record<string, unknown>;
  restrictions: Record<string, unknown>;
}

export interface TemplateRecord {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  category: string;
  workType: string;
  isActive: boolean;
  version: number;
  usageCount: number;
  templateParameters: TemplateParameterSet;
  createdAt: string;
  updatedAt: string;
}

export interface UserTemplateRecord {
  id: string;
  userId: string;
  baseTemplateId: string | null;
  name: string;
  description: string | null;
  isArchived: boolean;
  isPromoted: boolean;
  usageCount: number;
  templateParameters: TemplateParameterSet;
  createdAt: string;
  updatedAt: string;
}

export interface TemplateStats {
  officialCount: number;
  activeOfficialCount: number;
  userTemplateCount: number;
  promotedUserTemplateCount: number;
  archivedUserTemplateCount: number;
  topOfficialTemplates: Array<{
    id: string;
    name: string;
    slug: string;
    usageCount: number;
    version: number;
  }>;
}

export interface TemplateExportBundle {
  exportedAt: string;
  officialTemplates: TemplateRecord[];
  userTemplates: UserTemplateRecord[];
}

export interface TemplateImportResult {
  success: true;
  createdCount: number;
  updatedCount: number;
  skippedCount: number;
}

export interface WorkTypeSettingRecord {
  id: string;
  slug: string;
  label: string;
  isActive: boolean;
  requiredFixedPages: string[];
  optionalFixedPages: string[];
  createdAt: string;
  updatedAt: string;
}

export interface AnalysisCategoryRecord {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface AnalysisAddOnRecord {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  priceCents: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AnalysisTicketRecord {
  id: string;
  ticketNumber: string;
  customerUserId: string;
  assignedExpertUserId: string | null;
  categorySlug: string;
  categoryNameSnapshot: string;
  title: string;
  brief: string;
  status:
    | 'OPEN'
    | 'ASSIGNED'
    | 'QUOTED'
    | 'AWAITING_PAYMENT'
    | 'IN_PROGRESS'
    | 'DELIVERED'
    | 'REVISION_REQUESTED'
    | 'CLOSED'
    | 'CANCELLED';
  deliveryMode: 'STANDARD' | 'EXPRESS';
  quotePriceCents: number | null;
  quoteNote: string | null;
  quotedAt: string | null;
  customerApprovedAt: string | null;
  revisionCount: number;
  maxRevisions: number;
  rating: number | null;
  ratingComment: string | null;
  ratedAt: string | null;
  deadlineAt: string | null;
  assignedAt: string | null;
  closedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AnalysisTicketFileRecord {
  id: string;
  ticketId: string;
  uploadedByUserId: string;
  fileType: 'DATA' | 'DESCRIPTION' | 'SAMPLE' | 'RESULT';
  storageKey: string;
  originalFileName: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
}

export interface PaymentRecord {
  id: string;
  userId: string;
  analysisTicketId: string | null;
  documentId: string | null;
  subscriptionId: string | null;
  provider: 'STRIPE' | 'PAYPAL';
  type: 'ONE_TIME' | 'SUBSCRIPTION';
  status: 'PENDING' | 'REQUIRES_ACTION' | 'SUCCEEDED' | 'FAILED' | 'CANCELLED' | 'REFUNDED';
  currency: string;
  amountCents: number;
  providerPaymentId: string | null;
  checkoutSessionId: string | null;
  paidAt: string | null;
  failedAt: string | null;
  refundedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface StripeCheckoutSessionRecord {
  payment: PaymentRecord;
  sessionId: string;
  checkoutUrl: string;
  publishableKeyRequired: boolean;
}

export interface SubscriptionRecord {
  id: string;
  userId: string;
  provider: 'STRIPE' | 'PAYPAL';
  status: 'PENDING' | 'TRIALING' | 'ACTIVE' | 'PAST_DUE' | 'CANCELLED' | 'EXPIRED';
  interval: 'MONTH' | 'YEAR';
  planCode: string;
  currency: string;
  priceCents: number;
  providerSubscriptionId: string | null;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  canceledAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface StripeSubscriptionCheckoutSessionRecord {
  subscription: SubscriptionRecord;
  payment: PaymentRecord;
  sessionId: string;
  checkoutUrl: string;
  publishableKeyRequired: boolean;
}

export interface PayPalOrderRecord {
  payment: PaymentRecord;
  orderId: string;
  approveUrl: string;
}

export interface InvoiceRecord {
  id: string;
  invoiceNumber: string;
  userId: string;
  paymentId: string;
  currency: string;
  subtotalCents: number;
  discountCents: number;
  totalCents: number;
  issuedAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface GeoCurrencyResolution {
  country: string | null;
  currency: string;
  source: 'cdn-header' | 'ipapi' | 'default';
  ip: string | null;
}

export type StudentVerificationStatusValue =
  | 'PENDING'
  | 'VERIFIED'
  | 'REJECTED'
  | 'EXPIRED';

export interface StudentVerificationRecord {
  id: string;
  userId: string;
  provider: string;
  programId: string;
  verificationId: string | null;
  status: StudentVerificationStatusValue;
  redirectUrl: string | null;
  rejectionReason: string | null;
  verifiedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CouponValidationRecord {
  code: string;
  name: string;
  description: string | null;
  discountType: 'PERCENTAGE' | 'FIXED_AMOUNT';
  discountValue: number;
  currency: string | null;
  amountCents: number;
  discountCents: number;
  finalAmountCents: number;
}

export interface NdaAgreementRecord {
  id: string;
  ticketId: string;
  expertUserId: string;
  agreedAt: string | null;
  documentStorageKey: string | null;
  createdAt: string;
}

export interface AnalysisTicketDetail extends AnalysisTicketRecord {
  files: AnalysisTicketFileRecord[];
  ndaAgreement: NdaAgreementRecord | null;
}

export interface TicketMessageRecord {
  id: string;
  ticketId: string;
  senderUserId: string | null;
  senderType: 'CUSTOMER' | 'EXPERT' | 'SYSTEM';
  body: string;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

export interface ExpertProfileRecord {
  id: string;
  userId: string;
  bio: string | null;
  maxConcurrent: number;
  activeTickets: number;
  isAvailable: boolean;
  averageRating: number | null;
  totalCompleted: number;
  createdAt: string;
  updatedAt: string;
}

export interface DocumentUploadSessionSummary {
  sessionId: string;
  storageKey: string;
  uploadUrl: string;
  expiresIn: number;
  status: 'CREATED' | 'UPLOADED' | 'COMPLETED' | 'CANCELLED';
  progress: number;
}

export interface ParsedDocumentBlock {
  orderIndex: number;
  blockType: 'HEADING' | 'PARAGRAPH' | 'TABLE' | 'FIGURE' | 'EQUATION' | 'FOOTNOTE' | 'CITATION' | 'TABLE_CAPTION' | 'FIGURE_CAPTION';
  semanticSectionType:
    | 'ABSTRACT'
    | 'INTRODUCTION'
    | 'LITERATURE_REVIEW'
    | 'METHODS'
    | 'RESULTS'
    | 'DISCUSSION'
    | 'CONCLUSION'
    | 'REFERENCES'
    | 'APPENDIX'
    | 'ACKNOWLEDGMENT'
    | 'ABBREVIATIONS'
    | 'TABLE_OF_CONTENTS'
    | 'TABLE_LIST'
    | 'FIGURE_LIST'
    | 'CV'
    | 'DECLARATION'
    | 'BODY';
  title: string | null;
  text: string;
  level: number | null;
  confidenceScore: number;
  numberingPattern: string | null;
  lineLengthScore: number;
  hasCitation: boolean;
  hasFootnote: boolean;
  hasEquation: boolean;
  tableOrFigureLabel: string | null;
  templateSlot: string | null;
  numberingOverride: EditorBlockNumberingOverride | null;
  manualSequenceNumber: number | null;
  citations?: CitationInfo[];
  id?: string;
}

export type EditorBlockNumberingMode = 'INHERIT' | 'RENUMBER' | 'REMOVE' | 'CUSTOM';

export interface EditorBlockNumberingOverride {
  mode: EditorBlockNumberingMode;
  customValue?: string | null;
}

export interface EditorPageNumberingSettings {
  frontMatterStyle: 'roman' | 'arabic';
  bodyStyle: 'arabic' | 'roman';
  bodyStartPage: number;
  bodyStartNumber: number;
  unnumberedPages: number[];
}

export interface EditorSequenceSettings {
  tableStart: number;
  figureStart: number;
  equationStart: number;
}

export interface EditorDocumentSettings {
  pageNumbering: EditorPageNumberingSettings;
  sequence: EditorSequenceSettings;
}

export interface EditorCascadeNotification {
  id: string;
  type: 'heading-numbering' | 'section-order' | 'page-numbering' | 'sequence' | 'preview';
  severity: 'info' | 'warning';
  message: string;
}

export interface ParsedDocumentSummary {
  documentId: string;
  documentVersionId: string;
  durationMs: number;
  totalBlocks: number;
  headingCount: number;
  tableCount: number;
  figureCount: number;
  equationCount: number;
  footnoteCount: number;
  citationCount: number;
  averageConfidence: number;
  averageRunsPerBlock: number;
  lowConfidenceBlockCount: number;
  truncated: boolean;
  lowConfidence: boolean;
  aiAssisted: boolean;
  parseSource: 'docx' | 'pdf-conversion';
  citationStyle?: 'APA' | 'IEEE' | 'Vancouver' | 'Chicago' | 'unknown' | null;
}

export interface ParsedDocumentResult {
  summary: ParsedDocumentSummary;
  blocks: ParsedDocumentBlock[];
}

export interface CitationValidationReportEntryIssue {
  code: string;
  severity: 'ERROR' | 'WARNING' | 'INFO';
  message: string;
  fieldPath?: string;
  rawExcerpt?: string;
}

export interface CitationValidationReportEntry {
  entryIndex: number;
  status: 'PASS' | 'REVIEW' | 'FAIL';
  issueCount: number;
  errorCount: number;
  warningCount: number;
  infoCount: number;
  issues: CitationValidationReportEntryIssue[];
}

export interface CitationValidationReport {
  style: CitationStyleSlug | 'unknown';
  family: CitationFamily;
  status: 'COMPLIANT' | 'REVIEW_REQUIRED' | 'NON_COMPLIANT';
  issueCount: number;
  errorCount: number;
  warningCount: number;
  infoCount: number;
  entryCount: number;
  entries: CitationValidationReportEntry[];
  highlightedEntryIndexes: number[];
  recommendations: string[];
}

export interface DocumentCitationValidationReport {
  documentId: string;
  versionId: string;
  detectedStyle: CitationStyleSlug | 'unknown';
  detectedFamily: CitationFamily;
  confidenceScore: number;
  citationBlockOrderIndexes: number[];
  report: CitationValidationReport;
}

export interface ParsedDocumentDiagnostics {
  documentId: string;
  documentVersionId: string;
  blockTypeCounts: Record<
    'HEADING' | 'PARAGRAPH' | 'TABLE' | 'FIGURE' | 'EQUATION' | 'FOOTNOTE' | 'CITATION' | 'TABLE_CAPTION' | 'FIGURE_CAPTION',
    number
  >;
  semanticSectionCounts: Record<
    'ABSTRACT' | 'INTRODUCTION' | 'LITERATURE_REVIEW' | 'METHODS' | 'RESULTS' | 'DISCUSSION' | 'CONCLUSION' | 'REFERENCES' | 'APPENDIX' | 'ACKNOWLEDGMENT' | 'ABBREVIATIONS' | 'TABLE_OF_CONTENTS' | 'TABLE_LIST' | 'FIGURE_LIST' | 'CV' | 'DECLARATION' | 'BODY',
    number
  >;
  templateSlots: string[];
  lowConfidenceBlocks: Array<{
    orderIndex: number;
    title: string | null;
    blockType: 'HEADING' | 'PARAGRAPH' | 'TABLE' | 'FIGURE' | 'EQUATION' | 'FOOTNOTE' | 'CITATION' | 'TABLE_CAPTION' | 'FIGURE_CAPTION';
    confidenceScore: number;
  }>;
  parseSource: 'docx' | 'pdf-conversion';
  aiAssisted: boolean;
}

export interface ParsedDocumentMetrics {
  documentId: string;
  documentVersionId: string;
  durationMs: number;
  totalBlocks: number;
  averageConfidence: number;
  averageRunsPerBlock: number;
  headingCount: number;
  lowConfidenceBlockCount: number;
  truncated: boolean;
  aiAssisted: boolean;
  parseSource: 'docx' | 'pdf-conversion';
  queue: {
    parsePending: number;
    parseRetryAttempts: number;
    pdfConversionPending: number;
    lastQueuedAt: string | null;
    lastFailure: string | null;
  };
}
