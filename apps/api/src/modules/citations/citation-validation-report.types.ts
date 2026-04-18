import type { CitationFormatValidationIssue } from './citation-format-validator.types';
import type { CitationFamily } from './citation.types';
import type { CitationStyleSlug } from './citation.constants';

export type CitationValidationReportStatus =
  | 'COMPLIANT'
  | 'REVIEW_REQUIRED'
  | 'NON_COMPLIANT';

export type CitationEntryReportStatus = 'PASS' | 'REVIEW' | 'FAIL';

export interface CitationValidationReportEntryIssue {
  code: string;
  severity: CitationFormatValidationIssue['severity'];
  message: string;
  fieldPath?: string;
  rawExcerpt?: string;
}

export interface CitationValidationReportEntry {
  entryIndex: number;
  status: CitationEntryReportStatus;
  issueCount: number;
  errorCount: number;
  warningCount: number;
  infoCount: number;
  issues: CitationValidationReportEntryIssue[];
}

export interface CitationValidationReport {
  style: CitationStyleSlug;
  family: CitationFamily;
  status: CitationValidationReportStatus;
  issueCount: number;
  errorCount: number;
  warningCount: number;
  infoCount: number;
  entryCount: number;
  entries: CitationValidationReportEntry[];
  highlightedEntryIndexes: number[];
  recommendations: string[];
}
