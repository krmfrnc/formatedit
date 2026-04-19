// ──────────────────────────────────────────────
// Core formatting rule & severity types
// ──────────────────────────────────────────────

export type FormattingRuleType =
  | 'PAGE_LAYOUT'
  | 'TYPOGRAPHY'
  | 'HEADING_STYLE'
  | 'NUMBERING'
  | 'MARGIN'
  | 'SPACING'
  | 'PAGE_NUMBERING'
  | 'SECTION_ORDER'
  | 'CROSS_REFERENCE'
  | 'COVER_PAGE'
  | 'FIXED_PAGE';

export type FormattingSeverity = 'ERROR' | 'WARNING' | 'INFO';

export interface FormattingRule {
  type: FormattingRuleType;
  target: string;
  parameters: Record<string, unknown>;
}

// ──────────────────────────────────────────────
// Block metadata — strongly typed
// ──────────────────────────────────────────────

export interface BlockTypographyMeta {
  fontFamily: string;
  fontSizePt: number;
  isBold?: boolean;
  isItalic?: boolean;
  isUpperCase?: boolean;
  alignment: 'left' | 'center' | 'right' | 'justify';
  lineSpacing: number;
  spacingBeforePt: number;
  spacingAfterPt: number;
  firstLineIndentCm: number;
}

export interface BlockPageLayoutMeta {
  paperSize: string;
  orientation: 'portrait' | 'landscape';
  marginTopCm: number;
  marginBottomCm: number;
  marginLeftCm: number;
  marginRightCm: number;
  headerMarginCm: number;
  footerMarginCm: number;
  gutterCm: number;
}

export interface BlockHeadingMeta {
  level: number;
  numberingPattern: string | null;
  isInline: boolean;
  startsNewPage: boolean;
}

export interface BlockPageNumberMeta {
  pageNumber: string | null;
  pageNumberStyle: 'roman' | 'arabic' | 'none';
  pageNumberPosition: PageNumberPosition;
  pageNumberFontFamily: string;
  pageNumberFontSizePt: number;
}

export interface BlockSequenceMeta {
  sequenceNumber: number;
  sequenceType: 'table' | 'figure' | 'equation';
  chapterNumber: number | null;
  formattedLabel: string;
}

/** Unified metadata that every FormattedBlock carries after formatting. */
export interface FormattedBlockMetadata {
  // Page layout (set by PageLayoutApplierService)
  pageLayout?: BlockPageLayoutMeta;

  // Typography (set by TypographyApplierService)
  typography?: BlockTypographyMeta;

  // Heading specifics (set by HeadingStyleApplierService)
  heading?: BlockHeadingMeta;

  // Page numbering (set by PageNumberingApplierService)
  pageNumber?: BlockPageNumberMeta;

  // Sequence numbering (set by SequenceNumberingApplierService)
  sequence?: BlockSequenceMeta;

  // Cross-reference tracking
  crossReferencesUpdated?: boolean;

  // Semantic section type assigned by the parser (e.g. ABSTRACT, INTRODUCTION)
  semanticSectionType?: string;

  // Section slot for ordering purposes (set by SectionOrderApplierService)
  templateSlot?: string;

  // Any additional pass-through data
  [key: string]: unknown;
}

// ──────────────────────────────────────────────
// Formatted block (main data unit flowing through the pipeline)
// ──────────────────────────────────────────────

export interface FormattedBlock {
  orderIndex: number;
  blockType: string;
  appliedRules: FormattingRuleType[];
  text: string;
  metadata: FormattedBlockMetadata;
}

export interface FormattingResult {
  success: boolean;
  errors: FormattingValidationError[];
  warnings: FormattingValidationError[];
  infos: FormattingValidationError[];
  formattedBlocks: FormattedBlock[];
  generatedPages: FormattedBlock[];
  documentId: string;
  documentVersionId: string;
  durationMs: number;
}

export interface FormattingValidationError {
  severity: FormattingSeverity;
  code: string;
  message: string;
  blockIndex?: number;
  section?: string;
}

// ──────────────────────────────────────────────
// Queue job payload
// ──────────────────────────────────────────────

export interface FormattingJobPayload {
  documentId: string;
  documentVersionId: string;
  templateId: string;
  requestedBy: string;
  wizardData?: WizardData;
}

// ──────────────────────────────────────────────
// Settings interfaces (extracted from template parameters)
// ──────────────────────────────────────────────

export interface PageLayoutSettings {
  paperSize: string;
  orientation: 'portrait' | 'landscape';
  marginTopCm: number;
  marginBottomCm: number;
  marginLeftCm: number;
  marginRightCm: number;
  headerMarginCm: number;
  footerMarginCm: number;
  gutterCm: number;
}

export interface TypographySettings {
  fontFamily: string;
  fontSizePt: number;
  lineSpacing: number;
  paragraphSpacingBeforePt: number;
  paragraphSpacingAfterPt: number;
  alignment: 'left' | 'center' | 'right' | 'justify';
  firstLineIndentCm: number;
  // Additional block-specific sizes (v5 §4.9.2)
  captionFontSizePt?: number;
  footnoteFontSizePt?: number;
  tableContentFontSizePt?: number;
  pageNumberFontSizePt?: number;
}

export interface HeadingStyleLevel {
  level: number;
  fontFamily: string;
  fontSizePt: number;
  isBold: boolean;
  isItalic: boolean;
  isUpperCase: boolean;
  isInline: boolean;
  alignment: 'left' | 'center' | 'right' | 'justify';
  spacingBeforePt: number;
  spacingAfterPt: number;
  numberingFormat: string | null;
  startsNewPage: boolean;
}

export interface HeadingStyleSettings {
  levels: HeadingStyleLevel[];
}

// ──────────────────────────────────────────────
// Page numbering zone system (v5 §4.5.3)
// ──────────────────────────────────────────────

export type PageNumberStyle = 'roman' | 'arabic' | 'none';

export type PageNumberPosition =
  | 'bottom-center'
  | 'top-center'
  | 'top-right'
  | 'top-left'
  | 'bottom-right'
  | 'bottom-left';

export interface PageNumberZone {
  /** Identifier for the zone */
  id: string;
  /** 1-based start page of this zone */
  startPage: number;
  /** 1-based end page (inclusive). null means "to the end" */
  endPage: number | null;
  /** Numbering style */
  style: PageNumberStyle;
  /** Starting number for this zone */
  startNumber: number;
  /** Position of the page number on the page */
  position: PageNumberPosition;
  /** Font family for page numbers */
  fontFamily: string;
  /** Font size for page numbers */
  fontSizePt: number;
}

export interface PageNumberingSettings {
  zones: PageNumberZone[];
  /** Explicit list of pages with no number displayed */
  unnumberedPages: number[];
}

// ──────────────────────────────────────────────
// Sequence / element numbering mode
// ──────────────────────────────────────────────

export type SequenceNumberingMode = 'sequential' | 'chapterBased';

export interface SequenceNumberingSettings {
  mode: SequenceNumberingMode;
  tableStart: number;
  figureStart: number;
  equationStart: number;
  /** Separator between chapter and sequence numbers (e.g. ".") */
  chapterSeparator: string;
}

// ──────────────────────────────────────────────
// Cover page config (v5 §4.9.5)
// ──────────────────────────────────────────────

export interface CoverPageField {
  key: string;
  value: string;
  fontFamily?: string;
  fontSizePt?: number;
  isBold?: boolean;
  alignment?: 'left' | 'center' | 'right';
  spacingAfterPt?: number;
}

export interface CoverPageConfig {
  /** Number of cover pages to generate */
  coverCount: number;
  covers: SingleCoverConfig[];
}

export interface SingleCoverConfig {
  /** Type: outer binding / inner 1 / inner 2 */
  type: 'outer' | 'inner';
  fields: CoverPageField[];
  showLogo: boolean;
  logoUrl?: string;
  /** Special sizes for outer binding cover */
  customPageSize?: { widthCm: number; heightCm: number };
}

// ──────────────────────────────────────────────
// Approval page config
// ──────────────────────────────────────────────

export interface JuryMember {
  name: string;
  title: string;
  role: 'advisor' | 'co-advisor' | 'committee' | 'chair';
}

export interface ApprovalPageConfig {
  title: string;
  author: string;
  defenseDate: string;
  votingType: 'unanimous' | 'majority';
  juryMembers: JuryMember[];
}

// ──────────────────────────────────────────────
// Abstract config (v5 §4.11.2 structured abstract)
// ──────────────────────────────────────────────

export interface AbstractConfig {
  text: string;
  keywords: string[];
  language: 'tr' | 'en';
  /** Structured abstract section headings (for journal templates) */
  structuredSections?: StructuredAbstractSection[];
  /** Author name to display */
  author?: string;
  /** Title to display */
  title?: string;
  /** Date */
  date?: string;
}

export interface StructuredAbstractSection {
  heading: string;
  text: string;
}

// ──────────────────────────────────────────────
// Wizard data — collected in FAZ 5 (v5 §4.6)
// ──────────────────────────────────────────────

export interface WizardData {
  cover?: {
    university?: string;
    institute?: string;
    department?: string;
    title?: string;
    workType?: string;
    author?: string;
    advisor?: string;
    coAdvisor?: string;
    city?: string;
    date?: string;
  };
  approval?: ApprovalPageConfig;
  declaration?: {
    text?: string;
    showSignature?: boolean;
  };
  acknowledgment?: {
    text?: string;
  };
  abstractTr?: AbstractConfig;
  abstractEn?: AbstractConfig;
  abbreviations?: Array<{ abbreviation: string; expansion: string }>;
  cv?: {
    text?: string;
    format?: 'freeText' | 'yok';
  };
}

// ──────────────────────────────────────────────
// Table/Figure format settings (v5 §4.9.8)
// ──────────────────────────────────────────────

export interface TableFigureFormatSettings {
  tableCaptionPosition: 'above' | 'below';
  figureCaptionPosition: 'above' | 'below';
  numberingSystem: SequenceNumberingMode;
  numberFormat: string;
  captionIsBold: boolean;
  captionSeparator: string;
  sourcePosition: 'below';
  continuationFormat: string;
  continuationRepeatHeaders: boolean;
  tableAlignment: 'left' | 'center' | 'right';
  tableBorderStyle: 'full' | 'topBottom' | 'none';
}

// ──────────────────────────────────────────────
// Section ordering
// ──────────────────────────────────────────────

export interface SectionOrderSettings {
  order: string[];
}

// ──────────────────────────────────────────────
// Restrictions (v5 §4.9.11)
// ──────────────────────────────────────────────

export interface RestrictionSettings {
  abstractWordLimitMin?: number;
  abstractWordLimitMax?: number;
  mainTextWordLimitMin?: number;
  mainTextWordLimitMax?: number;
  keywordCountMin?: number;
  keywordCountMax?: number;
  plagiarismThresholdTotal?: number;
  plagiarismThresholdSingle?: number;
}

// ──────────────────────────────────────────────
// Pipeline context — carries state through the formatting pipeline
// ──────────────────────────────────────────────

export interface FormattingPipelineContext {
  documentId: string;
  documentVersionId: string;
  templateId: string;
  requestedBy: string;

  // Extracted from template parameters
  pageLayout: PageLayoutSettings;
  typography: TypographySettings;
  headingStyles: HeadingStyleSettings;
  pageNumbering: PageNumberingSettings;
  sequenceNumbering: SequenceNumberingSettings;
  sectionOrder: SectionOrderSettings;
  tableFigureFormat: TableFigureFormatSettings;
  restrictions: RestrictionSettings;

  // Wizard-supplied metadata
  wizardData: WizardData;

  // Cover configuration
  coverConfig: CoverPageConfig;

  // Fixed pages — which ones are required/optional for this work type
  fixedPages: {
    approval: boolean;
    declaration: boolean;
    abstractTr: boolean;
    abstractEn: boolean;
    tableOfContents: boolean;
    tableList: boolean;
    figureList: boolean;
    abbreviations: boolean;
    cv: boolean;
  };

  // Accumulated errors/warnings during the pipeline
  errors: FormattingValidationError[];
  warnings: FormattingValidationError[];
  infos: FormattingValidationError[];
}
