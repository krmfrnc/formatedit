export type ParsedBlockType =
  | 'HEADING'
  | 'PARAGRAPH'
  | 'TABLE'
  | 'FIGURE'
  | 'EQUATION'
  | 'FOOTNOTE'
  | 'CITATION';

export type SemanticSectionType =
  | 'ABSTRACT'
  | 'INTRODUCTION'
  | 'METHODS'
  | 'RESULTS'
  | 'DISCUSSION'
  | 'CONCLUSION'
  | 'REFERENCES'
  | 'APPENDIX'
  | 'BODY';

export interface ParsedRun {
  text: string;
  isBold: boolean;
  estimatedFontSize: number;
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
