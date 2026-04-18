import type { CitationStyleConversionEntry, CitationStyleConversionMode } from './citation-style-conversion.types';
import type { CitationFamily } from './citation.types';
import type { CitationStyleSlug } from './citation.constants';

export interface CitationStyleConversionPreviewEntry
  extends CitationStyleConversionEntry {
  previewIndex: number;
}

export interface CitationStyleConversionPreviewResult {
  sourceStyle: CitationStyleSlug;
  sourceFamily: CitationFamily;
  targetStyle: CitationStyleSlug;
  targetFamily: CitationFamily;
  mode: CitationStyleConversionMode;
  totalEntries: number;
  sampleSize: number;
  truncated: boolean;
  approximate: boolean;
  warningCount: number;
  previewEntries: CitationStyleConversionPreviewEntry[];
  summary: string;
  previewText: string;
}
