import type { CitationStyleSlug } from './citation.constants';
import type { CitationParseResult, ParsedCitation } from './citation.types';

export type CitationTextMatchStrategy =
  | 'author-year'
  | 'numeric-order'
  | 'notes-reuse'
  | 'mla-surname'
  | 'unmatched';

export interface DetectedInTextCitation {
  id: string;
  rawText: string;
  styleHint: CitationStyleSlug | 'unknown';
  family: CitationParseResult['family'] | 'unknown';
  startIndex: number;
  endIndex: number;
  authors: string[];
  year: number | null;
  pageReferences: string[];
  citationNumbers: number[];
  noteMarker: string | null;
}

export interface CitationTextMatchItem {
  citation: DetectedInTextCitation;
  matchedCitation: ParsedCitation | null;
  strategy: CitationTextMatchStrategy;
  confidenceScore: number;
}

export interface CitationTextMatchingResult {
  detectedCitations: DetectedInTextCitation[];
  matches: CitationTextMatchItem[];
  matchedCitationIds: string[];
  unmatchedBibliographyEntries: ParsedCitation[];
  coverage: {
    detectedCount: number;
    matchedCount: number;
    bibliographyCount: number;
    matchedBibliographyCount: number;
  };
}

export interface CitationTextMatchingInput {
  text: string;
  bibliography: CitationParseResult | ParsedCitation[];
  bibliographyStyle?: CitationStyleSlug;
}
