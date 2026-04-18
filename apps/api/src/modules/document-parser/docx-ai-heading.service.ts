import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { ParsedBlock } from './document-parser.types';

/**
 * Optional AI-assisted refinement pass for rule-based heading detection.
 *
 * Hard rule (`prompt.md` / v5 Madde 22): AI is an opt-in enhancement, never a
 * mandatory dependency. The service therefore runs a three-tier fallback:
 *
 *   1. `DOCX_AI_HEADING_ENABLED=false` (default)
 *      → passthrough. No work, no network.
 *
 *   2. Flag on, but `DOCX_AI_HEADING_PROVIDER=rule-based` OR the selected
 *      provider is missing required credentials (`*_BASE_URL`, `*_API_KEY`)
 *      → run the deterministic rule-based heuristic (boost confidence on
 *      blocks whose title text looks like a real title).
 *
 *   3. Flag on + provider configured with credentials
 *      → attempt an LLM call (`refineHeadingConfidencesAsync`). On any
 *      failure — network error, timeout, parse error, non-2xx response —
 *      we log a warning and fall back to the rule-based heuristic. The
 *      caller never sees an exception.
 *
 * The synchronous `refineHeadingConfidences` path only runs tiers 1–2 so
 * existing callers (tests, the synchronous parser pipeline) keep their
 * zero-IO guarantee. The async pipeline worker should call
 * `refineHeadingConfidencesAsync` when it wants tier 3.
 */
@Injectable()
export class DocxAiHeadingService {
  private readonly logger = new Logger(DocxAiHeadingService.name);

  constructor(private readonly configService: ConfigService) {}

  isEnabled(): boolean {
    return (
      this.configService.get<string>('docxAiHeadingEnabled', 'false') === 'true'
    );
  }

  private getProvider(): 'openai' | 'ollama' | 'rule-based' {
    const provider = this.configService.get<string>(
      'docxAiHeadingProvider',
      'rule-based',
    );
    if (provider === 'openai' || provider === 'ollama') {
      return provider;
    }
    return 'rule-based';
  }

  private hasLlmCredentials(): boolean {
    const baseUrl = this.configService.get<string>('docxAiHeadingBaseUrl', '');
    const model = this.configService.get<string>('docxAiHeadingModel', '');
    const apiKey = this.configService.get<string>('docxAiHeadingApiKey', '');
    const provider = this.getProvider();
    if (provider === 'rule-based') {
      return false;
    }
    // Ollama typically runs without an API key, but must have a base URL.
    if (provider === 'ollama') {
      return Boolean(baseUrl && model);
    }
    return Boolean(baseUrl && model && apiKey);
  }

  /**
   * Synchronous refinement. Tier 1 or tier 2 only — never performs I/O.
   */
  refineHeadingConfidences(blocks: ParsedBlock[]): ParsedBlock[] {
    if (!this.isEnabled()) {
      return blocks;
    }
    return this.applyRuleBasedRefinement(blocks);
  }

  /**
   * Async refinement with LLM fallback. Safe to call from workers: any
   * provider failure downgrades to the rule-based tier, then to passthrough.
   */
  async refineHeadingConfidencesAsync(
    blocks: ParsedBlock[],
  ): Promise<ParsedBlock[]> {
    if (!this.isEnabled()) {
      return blocks;
    }

    if (!this.hasLlmCredentials()) {
      return this.applyRuleBasedRefinement(blocks);
    }

    try {
      const refined = await this.callLlmProvider(blocks);
      if (refined) {
        return refined;
      }
      this.logger.warn(
        'LLM returned no refinement, falling back to rule-based heuristic',
      );
    } catch (error) {
      this.logger.warn(
        `LLM refinement failed, falling back to rule-based heuristic: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }

    return this.applyRuleBasedRefinement(blocks);
  }

  private applyRuleBasedRefinement(blocks: ParsedBlock[]): ParsedBlock[] {
    return blocks.map((block) => {
      if (block.blockType !== 'HEADING') {
        return block;
      }

      const title = (block.title ?? '').trim();
      const looksLikeTitle = /^[A-Z][A-Za-z0-9\s\-:,.'"()]{3,}$/m.test(title);
      const boosted = looksLikeTitle
        ? Math.min(1, Number((block.confidenceScore + 0.08).toFixed(3)))
        : block.confidenceScore;

      return {
        ...block,
        confidenceScore: boosted,
      };
    });
  }

  /**
   * Provider-specific LLM call. Returns `null` if the response is unusable,
   * throws on transport failure (caller catches and falls back). Kept tiny
   * on purpose: we send only heading candidates + scores and ask the model
   * to return a new score map. No document text leaves the worker beyond
   * the heading titles themselves.
   */
  private async callLlmProvider(
    blocks: ParsedBlock[],
  ): Promise<ParsedBlock[] | null> {
    const provider = this.getProvider();
    const baseUrl = this.configService.getOrThrow<string>(
      'docxAiHeadingBaseUrl',
    );
    const model = this.configService.getOrThrow<string>('docxAiHeadingModel');
    const timeoutMs = this.configService.get<number>(
      'docxAiHeadingTimeoutMs',
      15000,
    );

    const candidates = blocks
      .map((block, index) => ({ index, block }))
      .filter(({ block }) => block.blockType === 'HEADING')
      .map(({ index, block }) => ({
        id: index,
        title: (block.title ?? '').trim(),
        currentConfidence: block.confidenceScore,
      }));

    if (candidates.length === 0) {
      return blocks;
    }

    const prompt =
      'You are classifying academic document headings. For each candidate, ' +
      'return a JSON array of {"id": number, "confidence": number between 0 and 1}. ' +
      'Boost confidence if the text looks like a real section heading, lower it otherwise. ' +
      `Candidates: ${JSON.stringify(candidates)}`;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      if (provider === 'openai') {
        const apiKey = this.configService.getOrThrow<string>(
          'docxAiHeadingApiKey',
        );
        const response = await fetch(`${baseUrl.replace(/\/$/, '')}/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model,
            messages: [{ role: 'user', content: prompt }],
            temperature: 0,
          }),
          signal: controller.signal,
        });
        if (!response.ok) {
          throw new Error(`OpenAI returned status ${response.status}`);
        }
        const data = (await response.json()) as {
          choices?: Array<{ message?: { content?: string } }>;
        };
        const content = data.choices?.[0]?.message?.content;
        return this.applyLlmScoreMap(blocks, content);
      }

      // Ollama: /api/generate
      const response = await fetch(
        `${baseUrl.replace(/\/$/, '')}/api/generate`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ model, prompt, stream: false }),
          signal: controller.signal,
        },
      );
      if (!response.ok) {
        throw new Error(`Ollama returned status ${response.status}`);
      }
      const data = (await response.json()) as { response?: string };
      return this.applyLlmScoreMap(blocks, data.response);
    } finally {
      clearTimeout(timer);
    }
  }

  private applyLlmScoreMap(
    blocks: ParsedBlock[],
    rawContent: string | undefined,
  ): ParsedBlock[] | null {
    if (!rawContent) {
      return null;
    }
    // Models sometimes wrap JSON in prose; extract the first array.
    const match = rawContent.match(/\[[\s\S]*\]/);
    if (!match) {
      return null;
    }
    let parsed: Array<{ id?: number; confidence?: number }>;
    try {
      parsed = JSON.parse(match[0]) as Array<{
        id?: number;
        confidence?: number;
      }>;
    } catch {
      return null;
    }
    if (!Array.isArray(parsed)) {
      return null;
    }

    const scoreById = new Map<number, number>();
    for (const entry of parsed) {
      if (
        typeof entry.id === 'number' &&
        typeof entry.confidence === 'number' &&
        entry.confidence >= 0 &&
        entry.confidence <= 1
      ) {
        scoreById.set(entry.id, entry.confidence);
      }
    }

    if (scoreById.size === 0) {
      return null;
    }

    return blocks.map((block, index) => {
      if (block.blockType !== 'HEADING') {
        return block;
      }
      const llmScore = scoreById.get(index);
      if (llmScore === undefined) {
        return block;
      }
      return {
        ...block,
        confidenceScore: Number(llmScore.toFixed(3)),
      };
    });
  }
}
