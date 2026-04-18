import type { CitationFamily } from './citation.types';
import type { CitationStyleSlug } from './citation.constants';

export type CitationValidationSeverity = 'ERROR' | 'WARNING' | 'INFO';

export interface CitationFormatValidationIssue {
  severity: CitationValidationSeverity;
  code: string;
  message: string;
  entryIndex: number;
  style: CitationStyleSlug;
  family: CitationFamily;
  validationType: 'format';
  fieldPath?: string;
  rawExcerpt?: string;
}

export interface CitationEntryValidationSummary {
  entryIndex: number;
  severity: CitationValidationSeverity | 'NONE';
  issueCount: number;
  errorCount: number;
  warningCount: number;
  infoCount: number;
}

export interface CitationFormatValidationResult {
  style: CitationStyleSlug;
  family: CitationFamily;
  isValid: boolean;
  issues: CitationFormatValidationIssue[];
  summaries: CitationEntryValidationSummary[];
}
