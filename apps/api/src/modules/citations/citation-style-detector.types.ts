import type { CitationFamily } from './citation.types';
import type { CitationStyleSlug } from './citation.constants';
import type {
  CitationAiProvider,
  CitationAiStyleSuggestion,
} from './citation-ai-style-detector.types';

export interface CitationStyleDetectionSignal {
  key: string;
  score: number;
  detail: string;
}

export interface CitationStyleCandidate {
  style: CitationStyleSlug;
  family: CitationFamily;
  confidenceScore: number;
  reasons: string[];
}

export interface CitationStyleDetectionResult {
  style: CitationStyleSlug | 'unknown';
  family: CitationFamily;
  confidenceScore: number;
  candidates: CitationStyleCandidate[];
  signals: CitationStyleDetectionSignal[];
  aiAssisted: boolean;
  aiProvider: CitationAiProvider | null;
  aiModel: string | null;
  aiSuggestion: CitationAiStyleSuggestion | null;
}
