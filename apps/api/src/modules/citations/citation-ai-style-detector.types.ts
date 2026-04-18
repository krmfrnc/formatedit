import type { CitationStyleSlug } from './citation.constants';
import type { CitationFamily } from './citation.types';

export type CitationAiProvider = 'openai' | 'ollama';

export interface CitationAiStyleSuggestion {
  provider: CitationAiProvider;
  model: string;
  style: CitationStyleSlug;
  family: CitationFamily;
  confidenceScore: number;
  reasons: string[];
}

export interface CitationAiDetectionConfig {
  enabled: boolean;
  provider: CitationAiProvider;
  model: string;
  baseUrl: string;
  apiKey: string;
  timeoutMs: number;
}
