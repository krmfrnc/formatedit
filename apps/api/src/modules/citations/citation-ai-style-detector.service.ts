import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { z } from 'zod';
import { appLogger } from '../../common/logger';
import { supportedCitationStyles } from './citation.constants';
import type { CitationStyleCandidate } from './citation-style-detector.types';
import type {
  CitationAiDetectionConfig,
  CitationAiProvider,
  CitationAiStyleSuggestion,
} from './citation-ai-style-detector.types';
import type { CitationFamily } from './citation.types';

const citationAiResponseSchema = z.object({
  style: z.union([z.enum(supportedCitationStyles), z.literal('unknown')]),
  family: z.union([
    z.literal('author-date'),
    z.literal('numeric'),
    z.literal('notes-bibliography'),
    z.literal('mla'),
    z.literal('unknown'),
  ]),
  confidenceScore: z.number().min(0).max(1),
  reasons: z.array(z.string()).default([]),
});

@Injectable()
export class CitationAiStyleDetectorService {
  constructor(private readonly configService: ConfigService) {}

  isEnabled(): boolean {
    return this.configService.get<string>('citationAiEnabled', 'false') === 'true';
  }

  async refineStyle(input: {
    corpus: string;
    signals: Array<{ key: string; score: number; detail: string }>;
    candidates: CitationStyleCandidate[];
    ruleBasedStyle: CitationStyleCandidate['style'] | 'unknown';
    ruleBasedConfidence: number;
  }): Promise<CitationAiStyleSuggestion | null> {
    const config = this.resolveConfig();
    if (!this.shouldConsultAi(config, input)) {
      return null;
    }

    const response = await this.requestAiSuggestion(config, input);
    if (!response) {
      return null;
    }

    return response;
  }

  private shouldConsultAi(
    config: CitationAiDetectionConfig,
    input: {
      ruleBasedStyle: CitationStyleCandidate['style'] | 'unknown';
      ruleBasedConfidence: number;
      candidates: CitationStyleCandidate[];
    },
  ): boolean {
    if (!config.enabled || !config.model) {
      return false;
    }

    if (config.provider === 'openai' && !config.apiKey) {
      return false;
    }

    if (input.ruleBasedStyle === 'unknown' || input.ruleBasedConfidence < 0.58) {
      return true;
    }

    const sortedCandidates = [...input.candidates].sort(
      (left, right) => right.confidenceScore - left.confidenceScore,
    );
    const top = sortedCandidates[0];
    const runnerUp = sortedCandidates[1];

    if (!top || !runnerUp) {
      return false;
    }

    return top.confidenceScore - runnerUp.confidenceScore < 0.08;
  }

  private async requestAiSuggestion(
    config: CitationAiDetectionConfig,
    input: {
      corpus: string;
      signals: Array<{ key: string; score: number; detail: string }>;
      candidates: CitationStyleCandidate[];
    },
  ): Promise<CitationAiStyleSuggestion | null> {
    const endpoint =
      config.provider === 'ollama'
        ? `${config.baseUrl.replace(/\/$/, '')}/api/chat`
        : `${config.baseUrl.replace(/\/$/, '')}/chat/completions`;

    const controller = new AbortController();
    const timeout = globalThis.setTimeout(() => controller.abort(), config.timeoutMs);

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(config.provider === 'openai' && config.apiKey
            ? { Authorization: `Bearer ${config.apiKey}` }
            : {}),
        },
        signal: controller.signal,
        body: JSON.stringify(this.buildRequestBody(config.provider, config.model, input)),
      });

      if (!response.ok) {
        appLogger.warn('Citation AI style detector responded with a non-2xx status', {
          status: response.status,
          provider: config.provider,
        });
        return null;
      }

      const payload = (await response.json()) as {
        choices?: Array<{ message?: { content?: string | null } }>;
        message?: { content?: string | null };
        response?: string | null;
      };
      const content =
        payload.choices?.[0]?.message?.content ??
        payload.message?.content ??
        payload.response ??
        null;

      if (!content) {
        return null;
      }

      return this.parseSuggestion(config.provider, config.model, content);
    } catch (error) {
      appLogger.warn('Citation AI style detector failed', {
        provider: config.provider,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    } finally {
      clearTimeout(timeout);
    }
  }

  private buildRequestBody(
    provider: CitationAiProvider,
    model: string,
    input: {
      corpus: string;
      signals: Array<{ key: string; score: number; detail: string }>;
      candidates: CitationStyleCandidate[];
    },
  ): Record<string, unknown> {
    const supportedStyles = supportedCitationStyles.join(', ');
    const signalSummary = input.signals
      .map((signal) => `${signal.key} (${signal.score.toFixed(2)}): ${signal.detail}`)
      .join('\n');
    const candidateSummary = input.candidates
      .slice(0, 5)
      .map(
        (candidate) =>
          `${candidate.style} [${candidate.family}] ${candidate.confidenceScore.toFixed(3)} :: ${candidate.reasons.join('; ')}`,
      )
      .join('\n');

    const messages = [
      {
        role: 'system',
        content:
          'You are a citation style classifier. Return a single JSON object only. No markdown, no code fences, no commentary.',
      },
      {
        role: 'user',
        content: [
          `Supported styles: ${supportedStyles}`,
          'Choose the best citation style for this bibliography snippet.',
          'Return JSON with keys: style, family, confidenceScore, reasons.',
          'Use confidenceScore between 0 and 1.',
          '',
          'Signals:',
          signalSummary || '(none)',
          '',
          'Current rule-based candidates:',
          candidateSummary || '(none)',
          '',
          'Corpus:',
          input.corpus.slice(0, 6000),
        ].join('\n'),
      },
    ];

    if (provider === 'ollama') {
      return {
        model,
        stream: false,
        messages,
      };
    }

    return {
      model,
      temperature: 0,
      messages,
      response_format: { type: 'json_object' },
    };
  }

  private parseSuggestion(
    provider: CitationAiProvider,
    model: string,
    content: string,
  ): CitationAiStyleSuggestion | null {
    const parsed = this.parseJsonContent(content);
    if (!parsed) {
      return null;
    }

    const result = citationAiResponseSchema.safeParse(parsed);
    if (!result.success || result.data.style === 'unknown') {
      return null;
    }

    return {
      provider,
      model,
      style: result.data.style,
      family: result.data.family as CitationFamily,
      confidenceScore: Number(result.data.confidenceScore.toFixed(3)),
      reasons: result.data.reasons,
    };
  }

  private parseJsonContent(content: string): unknown {
    const trimmed = content.trim();
    if (!trimmed) {
      return null;
    }

    try {
      return JSON.parse(trimmed);
    } catch {
      const start = trimmed.indexOf('{');
      const end = trimmed.lastIndexOf('}');
      if (start === -1 || end === -1 || end <= start) {
        return null;
      }

      try {
        return JSON.parse(trimmed.slice(start, end + 1));
      } catch {
        return null;
      }
    }
  }

  private resolveConfig(): CitationAiDetectionConfig {
    const provider = this.configService.get<CitationAiProvider>('citationAiProvider', 'openai');
    const baseUrl =
      this.configService.get<string>('citationAiBaseUrl', '') ||
      (provider === 'ollama'
        ? 'http://localhost:11434'
        : 'https://api.openai.com/v1');

    return {
      enabled: this.isEnabled(),
      provider,
      model: this.configService.get<string>('citationAiModel', ''),
      baseUrl,
      apiKey: this.configService.get<string>('citationAiApiKey', ''),
      timeoutMs: Number(this.configService.get<number>('citationAiTimeoutMs', 15000)),
    };
  }
}
