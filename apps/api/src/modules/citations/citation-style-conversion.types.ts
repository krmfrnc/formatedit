import type { CitationStyleSlug } from './citation.constants';
import type { CitationFamily, CitationParseResult, ParsedCitation } from './citation.types';

export type CitationStyleConversionMode = 'same-family' | 'cross-family' | 'fallback';

export type CitationStyleConversionWarningSeverity = 'INFO' | 'WARNING';

export interface CitationStyleConversionWarning {
  code: string;
  severity: CitationStyleConversionWarningSeverity;
  message: string;
  fieldPath?: string;
}

export interface CitationStyleConversionSegment {
  kind:
    | 'prefix'
    | 'authors'
    | 'year'
    | 'title'
    | 'container'
    | 'details'
    | 'locator';
  text: string;
  emphasis?: boolean;
  quoted?: boolean;
}

export interface CitationStyleConversionEntry {
  entryIndex: number;
  sourceStyle: CitationStyleSlug;
  targetStyle: CitationStyleSlug;
  sourceFamily: CitationFamily;
  targetFamily: CitationFamily;
  sourceText: string;
  convertedText: string;
  segments: CitationStyleConversionSegment[];
  warnings: CitationStyleConversionWarning[];
  approximate: boolean;
  confidenceScore: number;
}

export interface CitationStyleConversionResult {
  sourceStyle: CitationStyleSlug;
  sourceFamily: CitationFamily;
  targetStyle: CitationStyleSlug;
  targetFamily: CitationFamily;
  mode: CitationStyleConversionMode;
  entryCount: number;
  convertedCount: number;
  approximate: boolean;
  warningCount: number;
  entries: CitationStyleConversionEntry[];
  bibliographyText: string;
}

export interface CitationStyleConversionInput {
  bibliography: CitationParseResult | ParsedCitation[];
  sourceStyle?: CitationStyleSlug;
  targetStyle: CitationStyleSlug;
}
