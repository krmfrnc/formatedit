export type FormattingRuleType =
  | 'PAGE_LAYOUT'
  | 'TYPOGRAPHY'
  | 'HEADING_STYLE'
  | 'NUMBERING'
  | 'MARGIN'
  | 'SPACING';

export type FormattingSeverity = 'ERROR' | 'WARNING' | 'INFO';

export interface FormattingRule {
  type: FormattingRuleType;
  target: string;
  parameters: Record<string, unknown>;
}

export interface FormattedBlock {
  orderIndex: number;
  blockType: string;
  appliedRules: FormattingRuleType[];
  text: string;
  metadata?: Record<string, unknown>;
}

export interface FormattingResult {
  success: boolean;
  errors: FormattingValidationError[];
  warnings: FormattingValidationError[];
  formattedBlocks: FormattedBlock[];
  documentId: string;
  documentVersionId: string;
  durationMs: number;
}

export interface FormattingValidationError {
  severity: FormattingSeverity;
  code: string;
  message: string;
  blockIndex?: number;
}

export interface FormattingJobPayload {
  documentId: string;
  documentVersionId: string;
  templateId: string;
  requestedBy: string;
}

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
}

export interface HeadingStyleLevel {
  level: number;
  fontFamily: string;
  fontSizePt: number;
  isBold: boolean;
  isItalic: boolean;
  alignment: 'left' | 'center' | 'right' | 'justify';
  spacingBeforePt: number;
  spacingAfterPt: number;
  numberingFormat: string | null;
}

export interface HeadingStyleSettings {
  levels: HeadingStyleLevel[];
}
