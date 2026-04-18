import type { CitationStyleSlug } from './citation.constants';
import type { CitationFamily, CitationParseResult, ParsedCitation } from './citation.types';

export type CitationBibliographyOrderMode = 'alphabetical' | 'citation-order';

export interface CitationBibliographyOrderEntry extends ParsedCitation {
  originalOrderIndex: number;
  sortedOrderIndex: number;
  sortKey: string;
  moved: boolean;
}

export interface CitationBibliographyOrderResult {
  sourceStyle: CitationStyleSlug | 'unknown';
  sourceFamily: CitationFamily | 'unknown';
  orderMode: CitationBibliographyOrderMode;
  entryCount: number;
  movedCount: number;
  bibliographyText: string;
  entries: CitationBibliographyOrderEntry[];
}

export interface CitationBibliographyOrderInput {
  bibliography: CitationParseResult | ParsedCitation[];
  orderMode: CitationBibliographyOrderMode;
  bibliographyStyle?: CitationStyleSlug;
}
