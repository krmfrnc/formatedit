import type { CitationStyleSlug } from './citation.constants';

export type CitationFamily =
  | 'author-date'
  | 'numeric'
  | 'notes-bibliography'
  | 'mla'
  | 'unknown';

export interface ParsedCitation {
  orderIndex: number;
  style: CitationStyleSlug;
  family: CitationFamily;
  rawText: string;
  authors: string[];
  year: number | null;
  title: string | null;
  containerTitle: string | null;
  volume: string | null;
  issue: string | null;
  pages: string | null;
  publisher: string | null;
  doi: string | null;
  url: string | null;
  note: string | null;
  confidenceScore: number;
  normalizedText: string;
}

export interface CitationParseResult {
  style: CitationStyleSlug;
  family: CitationFamily;
  entries: ParsedCitation[];
}

