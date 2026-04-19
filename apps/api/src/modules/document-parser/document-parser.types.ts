export type ParsedBlockType =
  | 'HEADING'
  | 'PARAGRAPH'
  | 'TABLE'
  | 'FIGURE'
  | 'EQUATION'
  | 'FOOTNOTE'
  | 'CITATION'
  | 'TABLE_CAPTION'
  | 'FIGURE_CAPTION';

export type SemanticSectionType =
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

export interface ParsedRun {
  text: string;
  isBold: boolean;
  isItalic?: boolean;
  isSuperscript?: boolean;
  estimatedFontSize: number;
}

export interface CitationInfo {
  /** The raw matched text */
  raw: string;
  /** Detected citation style */
  style: 'apa' | 'ieee' | 'vancouver' | 'chicago' | 'inline' | 'unknown';
  /** Author name(s) if extractable */
  authors?: string[];
  /** Year if extractable */
  year?: string;
  /** Numeric reference(s) if extractable */
  numbers?: number[];
}

export interface EquationInfo {
  /** The raw equation text or marker */
  raw: string;
  /** The detection source */
  source: 'latex' | 'mathml' | 'omml' | 'symbol' | 'keyword' | 'inline';
  /** Equation number if present (e.g., "(2.1)") */
  equationNumber?: string;
}

export interface FootnoteInfo {
  /** The footnote marker text */
  marker: string;
  /** The detection source */
  source: 'superscript' | 'bracket' | 'xml' | 'text';
  /** Footnote number if extractable */
  number?: number;
}

export interface ParsedBlock {
  orderIndex: number;
  blockType: ParsedBlockType;
  semanticSectionType: SemanticSectionType;
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
  numberingOverride: {
    mode: 'INHERIT' | 'RENUMBER' | 'REMOVE' | 'CUSTOM';
    customValue?: string | null;
  } | null;
  manualSequenceNumber: number | null;
  runs: ParsedRun[];
  /** Detected citations in this block */
  citations?: CitationInfo[];
  /** Detected equations in this block */
  equations?: EquationInfo[];
  /** Detected footnotes in this block */
  footnotes?: FootnoteInfo[];
  /** For TABLE_CAPTION / FIGURE_CAPTION: the caption text without label */
  captionText?: string;
}

export interface ParseSummary {
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
  /** Detected dominant citation style */
  citationStyle?: string;
}

export interface ParseResultResponse {
  summary: ParseSummary;
  blocks: ParsedBlock[];
}

export interface OutlineNode {
  title: string;
  level: number;
  orderIndex: number;
  confidenceScore: number;
  children: OutlineNode[];
}

export interface ConfidenceScoreResponse {
  documentId: string;
  documentVersionId: string;
  averageConfidence: number;
  headingAverageConfidence: number;
  blockCount: number;
  lowConfidence: boolean;
  aiAssisted: boolean;
}

export interface ParseDiagnosticsResponse {
  documentId: string;
  documentVersionId: string;
  blockTypeCounts: Record<ParsedBlockType, number>;
  semanticSectionCounts: Record<SemanticSectionType, number>;
  templateSlots: string[];
  lowConfidenceBlocks: Array<{
    orderIndex: number;
    title: string | null;
    blockType: ParsedBlockType;
    confidenceScore: number;
  }>;
  parseSource: 'docx' | 'pdf-conversion';
  aiAssisted: boolean;
  citationStyle?: string;
}

export interface ParseMetricsResponse {
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

export interface ParseJobPayload {
  documentId: string;
  documentVersionId: string;
  requestedBy: string;
  storageKey?: string;
}
