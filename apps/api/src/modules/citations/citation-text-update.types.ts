import type { CitationStyleSlug } from './citation.constants';
import type { CitationFamily, CitationParseResult, ParsedCitation } from './citation.types';
import type { CitationStyleConversionWarning } from './citation-style-conversion.types';
import type { CitationTextMatchStrategy } from './citation-text-matcher.types';

export interface CitationTextUpdateChange {
  startIndex: number;
  endIndex: number;
  sourceText: string;
  replacementText: string;
  strategy: CitationTextMatchStrategy;
  matchedCitationIds: string[];
  confidenceScore: number;
  approximate: boolean;
  warningCodes: string[];
  preserved: boolean;
}

export interface CitationTextUpdateResult {
  sourceStyle: CitationStyleSlug | 'unknown';
  sourceFamily: CitationFamily | 'unknown';
  targetStyle: CitationStyleSlug;
  targetFamily: CitationFamily;
  sourceText: string;
  updatedText: string;
  totalDetectedCount: number;
  matchedCount: number;
  updatedCount: number;
  unmatchedCount: number;
  approximate: boolean;
  warningCount: number;
  changes: CitationTextUpdateChange[];
  warnings: CitationStyleConversionWarning[];
}

export interface CitationTextUpdateInput {
  text: string;
  bibliography: CitationParseResult | ParsedCitation[];
  targetStyle: CitationStyleSlug;
  bibliographyStyle?: CitationStyleSlug;
}
