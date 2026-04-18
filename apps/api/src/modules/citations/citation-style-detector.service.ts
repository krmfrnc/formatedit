import { Injectable } from '@nestjs/common';
import type { CitationStyleSlug } from './citation.constants';
import { CitationAiStyleDetectorService } from './citation-ai-style-detector.service';
import type { CitationAiStyleSuggestion } from './citation-ai-style-detector.types';
import type {
  CitationStyleCandidate,
  CitationStyleDetectionResult,
  CitationStyleDetectionSignal,
} from './citation-style-detector.types';

const authorDatePattern = /\(\s*(?:19|20)\d{2}[a-z]?\s*\)/g;
const numericBracketPattern = /\[[0-9]+(?:\s*[-,;]\s*[0-9]+)*\]/g;
const numberedReferencePattern = /^\s*[0-9]+[.)]\s+/gm;
const mlaMarkersPattern = /(?:vol\.|no\.|pp\.|accessed|n\. pag\.|ed\.|eds\.)/gi;
const notesMarkersPattern = /(?:ibid\.|op\. cit\.|loc\. cit\.|supra)/gi;
const doiUrlPattern = /https?:\/\/(?:dx\.)?doi\.org\//gi;
const doiPrefixPattern = /\bdoi:\s*/gi;
const ampersandPattern = /\s&\s/g;
const andPattern = /\band\b/gi;
const quotedTitlePattern = /["“][^"”]{8,}["”]/g;
const initialsPattern = /\b[A-Z]\.(?:\s*[A-Z]\.)+/g;
const yearAtEndPattern = /(?:19|20)\d{2}[a-z]?\s*$/gm;
const journalAbbrevPattern = /\b(?:J\.|JAMA|N Engl J Med|Trans\.|Proc\.|Rev\.)\b/g;

@Injectable()
export class CitationStyleDetectorService {
  constructor(
    private readonly citationAiStyleDetectorService: CitationAiStyleDetectorService,
  ) {}

  async detectCitationStyle(
    input: string | string[],
  ): Promise<CitationStyleDetectionResult> {
    const corpus = this.normalizeInput(input);
    const signals = this.collectSignals(corpus);
    const ruleCandidates = this.scoreCandidates(corpus, signals).sort(
      (left, right) => right.confidenceScore - left.confidenceScore,
    );
    const best = this.resolveBestStyle(corpus, signals, ruleCandidates);
    const aiSuggestion = await this.citationAiStyleDetectorService.refineStyle({
      corpus,
      signals,
      candidates: ruleCandidates,
      ruleBasedStyle: best?.style ?? 'unknown',
      ruleBasedConfidence: best?.confidenceScore ?? 0,
    });
    const selected = this.selectBestCandidate(best, aiSuggestion);
    const candidates = this.mergeCandidates(ruleCandidates, aiSuggestion);
    const confidenceScore = selected?.confidenceScore ?? 0;
    const style =
      selected && selected.confidenceScore >= 0.35 ? selected.style : 'unknown';
    const family =
      selected && selected.confidenceScore >= 0.35 ? selected.family : 'unknown';

    return {
      style,
      family,
      confidenceScore: Number(confidenceScore.toFixed(3)),
      candidates: candidates.slice(0, 5).map((candidate) => ({
        ...candidate,
        confidenceScore: Number(candidate.confidenceScore.toFixed(3)),
      })),
      signals,
      aiAssisted: Boolean(aiSuggestion),
      aiProvider: aiSuggestion?.provider ?? null,
      aiModel: aiSuggestion?.model ?? null,
      aiSuggestion: aiSuggestion ?? null,
    };
  }

  async detectFromEntries(entries: string[]): Promise<CitationStyleDetectionResult> {
    return this.detectCitationStyle(entries);
  }

  private mergeCandidates(
    candidates: CitationStyleCandidate[],
    aiSuggestion: CitationAiStyleSuggestion | null,
  ): CitationStyleCandidate[] {
    if (!aiSuggestion) {
      return candidates;
    }

    const merged = [...candidates];
    const existingIndex = merged.findIndex(
      (candidate) => candidate.style === aiSuggestion.style,
    );

    if (existingIndex >= 0) {
      const existing = merged[existingIndex];
      merged[existingIndex] = {
        ...existing,
        confidenceScore: Math.max(existing.confidenceScore, aiSuggestion.confidenceScore),
        reasons: [...existing.reasons, ...aiSuggestion.reasons],
      };
      return merged.sort((left, right) => right.confidenceScore - left.confidenceScore);
    }

    merged.push({
      style: aiSuggestion.style,
      family: aiSuggestion.family,
      confidenceScore: aiSuggestion.confidenceScore,
      reasons: [...aiSuggestion.reasons, `AI provider: ${aiSuggestion.provider}`],
    });

    return merged.sort((left, right) => right.confidenceScore - left.confidenceScore);
  }

  private selectBestCandidate(
    ruleBased: CitationStyleCandidate | null,
    aiSuggestion: CitationAiStyleSuggestion | null,
  ): CitationStyleCandidate | null {
    if (!aiSuggestion) {
      return ruleBased;
    }

    const aiCandidate: CitationStyleCandidate = {
      style: aiSuggestion.style,
      family: aiSuggestion.family,
      confidenceScore: aiSuggestion.confidenceScore,
      reasons: aiSuggestion.reasons,
    };

    if (!ruleBased) {
      return aiCandidate;
    }

    if (aiCandidate.confidenceScore >= ruleBased.confidenceScore + 0.08) {
      return aiCandidate;
    }

    if (ruleBased.confidenceScore < 0.55 && aiCandidate.confidenceScore >= 0.45) {
      return aiCandidate;
    }

    return ruleBased;
  }

  private normalizeInput(input: string | string[]): string {
    const raw = Array.isArray(input) ? input.join('\n') : input;
    return raw.replace(/\r\n/g, '\n').trim();
  }

  private collectSignals(
    corpus: string,
  ): CitationStyleDetectionSignal[] {
    const signals: CitationStyleDetectionSignal[] = [];

    const authorDateMatches = corpus.match(authorDatePattern) ?? [];
    if (authorDateMatches.length) {
      signals.push({
        key: 'author-date',
        score: Math.min(1, authorDateMatches.length / 2),
        detail: `${authorDateMatches.length} author-date patterns found`,
      });
    }

    const numericBracketMatches = corpus.match(numericBracketPattern) ?? [];
    if (numericBracketMatches.length) {
      signals.push({
        key: 'numeric-brackets',
        score: Math.min(1, numericBracketMatches.length / 2),
        detail: `${numericBracketMatches.length} bracketed numeric citation patterns found`,
      });
    }

    const numberedReferenceMatches =
      corpus.match(numberedReferencePattern) ?? [];
    if (numberedReferenceMatches.length) {
      signals.push({
        key: 'numbered-bibliography',
        score: Math.min(1, numberedReferenceMatches.length / 3),
        detail: `${numberedReferenceMatches.length} numbered bibliography entries found`,
      });
    }

    const mlaMatches = corpus.match(mlaMarkersPattern) ?? [];
    if (mlaMatches.length) {
      signals.push({
        key: 'mla-markers',
        score: Math.min(1, mlaMatches.length / 3),
        detail: `${mlaMatches.length} MLA markers found`,
      });
    }

    const notesMatches = corpus.match(notesMarkersPattern) ?? [];
    if (notesMatches.length) {
      signals.push({
        key: 'notes-markers',
        score: Math.min(1, notesMatches.length / 2),
        detail: `${notesMatches.length} notes-bibliography markers found`,
      });
    }

    const doiUrlMatches = corpus.match(doiUrlPattern) ?? [];
    if (doiUrlMatches.length) {
      signals.push({
        key: 'doi-url',
        score: Math.min(1, doiUrlMatches.length / 2),
        detail: `${doiUrlMatches.length} DOI URLs found`,
      });
    }

    const doiPrefixMatches = corpus.match(doiPrefixPattern) ?? [];
    if (doiPrefixMatches.length) {
      signals.push({
        key: 'doi-prefix',
        score: Math.min(1, doiPrefixMatches.length / 2),
        detail: `${doiPrefixMatches.length} DOI prefixes found`,
      });
    }

    const ampersandMatches = corpus.match(ampersandPattern) ?? [];
    if (ampersandMatches.length) {
      signals.push({
        key: 'ampersand-authors',
        score: Math.min(1, ampersandMatches.length / 2),
        detail: `${ampersandMatches.length} ampersand author connectors found`,
      });
    }

    const andMatches = corpus.match(andPattern) ?? [];
    if (andMatches.length) {
      signals.push({
        key: 'and-authors',
        score: Math.min(1, andMatches.length / 4),
        detail: `${andMatches.length} "and" author connectors found`,
      });
    }

    const quotedTitleMatches = corpus.match(quotedTitlePattern) ?? [];
    if (quotedTitleMatches.length) {
      signals.push({
        key: 'quoted-title',
        score: Math.min(1, quotedTitleMatches.length / 2),
        detail: `${quotedTitleMatches.length} quoted titles found`,
      });
    }

    const initialsMatches = corpus.match(initialsPattern) ?? [];
    if (initialsMatches.length) {
      signals.push({
        key: 'initials',
        score: Math.min(1, initialsMatches.length / 3),
        detail: `${initialsMatches.length} author-initial patterns found`,
      });
    }

    const yearEndMatches = corpus.match(yearAtEndPattern) ?? [];
    if (yearEndMatches.length) {
      signals.push({
        key: 'year-end',
        score: Math.min(1, yearEndMatches.length / 2),
        detail: `${yearEndMatches.length} end-of-entry years found`,
      });
    }

    const journalAbbrevMatches = corpus.match(journalAbbrevPattern) ?? [];
    if (journalAbbrevMatches.length) {
      signals.push({
        key: 'journal-abbrev',
        score: Math.min(1, journalAbbrevMatches.length / 2),
        detail: `${journalAbbrevMatches.length} journal abbreviation markers found`,
      });
    }

    return signals;
  }

  private scoreCandidates(
    corpus: string,
    signals: CitationStyleDetectionSignal[],
  ): CitationStyleCandidate[] {
    const hasAuthorDate = signals.some((signal) => signal.key === 'author-date');
    const hasNumeric = signals.some(
      (signal) =>
        signal.key === 'numeric-brackets' ||
        signal.key === 'numbered-bibliography',
    );
    const hasNotes = signals.some((signal) => signal.key === 'notes-markers');
    const hasMlaMarkers = signals.some((signal) => signal.key === 'mla-markers');
    const hasQuotedTitle = signals.some(
      (signal) => signal.key === 'quoted-title',
    );
    const hasDoiUrl = signals.some((signal) => signal.key === 'doi-url');
    const hasDoiPrefix = signals.some(
      (signal) => signal.key === 'doi-prefix',
    );
    const hasAmpersand = signals.some(
      (signal) => signal.key === 'ampersand-authors',
    );
    const hasAnd = signals.some((signal) => signal.key === 'and-authors');
    const hasInitials = signals.some((signal) => signal.key === 'initials');
    const hasYearEnd = signals.some((signal) => signal.key === 'year-end');
    const hasJournalAbbrev = signals.some(
      (signal) => signal.key === 'journal-abbrev',
    );

    return [
      this.scoreApa7({
        hasAuthorDate,
        hasDoiUrl,
        hasAmpersand,
        hasInitials,
        corpus,
        signals,
      }),
      this.scoreApa6({
        hasAuthorDate,
        hasDoiPrefix,
        hasInitials,
        hasAnd,
        corpus,
      }),
      this.scoreChicagoAuthorDate({
        hasAuthorDate,
        hasAnd,
        hasYearEnd,
        hasJournalAbbrev,
      }),
      this.scoreHarvard({
        hasAuthorDate,
        hasAnd,
        hasInitials,
        hasDoiUrl,
      }),
      this.scoreMla({
        hasMlaMarkers,
        hasQuotedTitle,
        hasAnd,
        hasYearEnd,
      }),
      this.scoreChicagoNotes({
        hasNotes,
        hasYearEnd,
      }),
      this.scoreVancouver({
        hasNumeric,
        hasInitials,
        hasJournalAbbrev,
        hasQuotedTitle,
      }),
      this.scoreIeee({
        hasNumeric,
        hasQuotedTitle,
        hasJournalAbbrev,
        hasDoiUrl,
      }),
      this.scoreMdpi({
        hasNumeric,
        hasDoiUrl,
        hasInitials,
        hasJournalAbbrev,
      }),
      this.scoreAma({
        hasNumeric,
        hasInitials,
        hasJournalAbbrev,
      }),
      this.scoreNlm({
        hasNumeric,
        hasInitials,
        hasJournalAbbrev,
        hasDoiPrefix,
      }),
    ];
  }

  private resolveBestStyle(
    corpus: string,
    signals: CitationStyleDetectionSignal[],
    candidates: CitationStyleCandidate[],
  ): CitationStyleCandidate | null {
    const hasAuthorDate = signals.some((signal) => signal.key === 'author-date');
    const hasNumeric = signals.some(
      (signal) =>
        signal.key === 'numeric-brackets' ||
        signal.key === 'numbered-bibliography',
    );
    const hasNotes = signals.some((signal) => signal.key === 'notes-markers');
    const hasMlaMarkers = signals.some((signal) => signal.key === 'mla-markers');
    const hasQuotedTitle = signals.some(
      (signal) => signal.key === 'quoted-title',
    );
    const hasDoiUrl = signals.some((signal) => signal.key === 'doi-url');
    const hasDoiPrefix = signals.some(
      (signal) => signal.key === 'doi-prefix',
    );
    const hasAmpersand = signals.some(
      (signal) => signal.key === 'ampersand-authors',
    );
    const hasAnd = signals.some((signal) => signal.key === 'and-authors');
    const hasInitials = signals.some((signal) => signal.key === 'initials');
    const hasJournalAbbrev = signals.some(
      (signal) => signal.key === 'journal-abbrev',
    );

    if (!hasAuthorDate && !hasNumeric && !hasNotes && !hasMlaMarkers) {
      return null;
    }

    if (hasNotes) {
      return this.resolveCandidate('chicago-notes-bibliography', candidates);
    }

    if (hasAuthorDate) {
      if (hasAmpersand || hasDoiUrl) {
        return this.resolveCandidate('apa-7', candidates);
      }

      if (hasDoiPrefix && !hasDoiUrl) {
        return this.resolveCandidate('apa-6', candidates);
      }

      if (hasAnd && !hasAmpersand) {
        if (hasJournalAbbrev || /(?:\bvol\.|\bno\.|\bpp\.)/i.test(corpus)) {
          return this.resolveCandidate('chicago-author-date', candidates);
        }

        return this.resolveCandidate('harvard', candidates);
      }

      return this.resolveCandidate('apa-7', candidates);
    }

    if (hasNumeric) {
      if (hasQuotedTitle && (hasJournalAbbrev || /\bIEEE\b/.test(corpus))) {
        return this.resolveCandidate('ieee', candidates);
      }

      if (hasDoiUrl || /\b(?:pp\.|pages?)\b/i.test(corpus)) {
        return this.resolveCandidate('mdpi', candidates);
      }

      if (hasInitials && hasJournalAbbrev) {
        return this.resolveCandidate('ama', candidates);
      }

      return this.resolveCandidate('vancouver', candidates);
    }

    if (hasMlaMarkers && hasQuotedTitle) {
      return this.resolveCandidate('mla', candidates);
    }

    if (hasMlaMarkers) {
      return this.resolveCandidate('mla', candidates);
    }

    return candidates[0] ?? null;
  }

  private resolveCandidate(
    style: CitationStyleSlug,
    candidates: CitationStyleCandidate[],
  ): CitationStyleCandidate | null {
    return (
      candidates.find((candidate) => candidate.style === style) ??
      candidates[0] ??
      null
    );
  }

  private scoreApa7(input: {
    hasAuthorDate: boolean;
    hasDoiUrl: boolean;
    hasAmpersand: boolean;
    hasInitials: boolean;
    corpus: string;
    signals: CitationStyleDetectionSignal[];
  }): CitationStyleCandidate {
    let confidenceScore = 0.12;
    const reasons: string[] = [];

    if (input.hasAuthorDate) {
      confidenceScore += 0.35;
      reasons.push('author-date pattern found');
    }

    if (input.hasAmpersand) {
      confidenceScore += 0.12;
      reasons.push('ampersand author connector');
    }

    if (input.hasDoiUrl) {
      confidenceScore += 0.12;
      reasons.push('DOI URL detected');
    }

    if (input.hasInitials) {
      confidenceScore += 0.08;
      reasons.push('author initials detected');
    }

    if (/\b(?:et al\.|&)\b/i.test(input.corpus)) {
      confidenceScore += 0.05;
      reasons.push('APA-like multi-author shorthand');
    }

    return {
      style: 'apa-7',
      family: 'author-date',
      confidenceScore: this.clampScore(confidenceScore, input.signals),
      reasons,
    };
  }

  private scoreApa6(input: {
    hasAuthorDate: boolean;
    hasDoiPrefix: boolean;
    hasInitials: boolean;
    hasAnd: boolean;
    corpus: string;
  }): CitationStyleCandidate {
    let confidenceScore = 0.1;
    const reasons: string[] = [];

    if (input.hasAuthorDate) {
      confidenceScore += 0.3;
      reasons.push('author-date pattern found');
    }

    if (input.hasDoiPrefix) {
      confidenceScore += 0.14;
      reasons.push('legacy DOI prefix detected');
    }

    if (input.hasInitials) {
      confidenceScore += 0.08;
      reasons.push('author initials detected');
    }

    if (input.hasAnd && !/\s&\s/.test(input.corpus)) {
      confidenceScore += 0.04;
      reasons.push('"and" connector present without APA ampersand');
    }

    return {
      style: 'apa-6',
      family: 'author-date',
      confidenceScore: this.clampScore(confidenceScore),
      reasons,
    };
  }

  private scoreChicagoAuthorDate(input: {
    hasAuthorDate: boolean;
    hasAnd: boolean;
    hasYearEnd: boolean;
    hasJournalAbbrev: boolean;
  }): CitationStyleCandidate {
    let confidenceScore = 0.08;
    const reasons: string[] = [];

    if (input.hasAuthorDate) {
      confidenceScore += 0.28;
      reasons.push('author-date pattern found');
    }

    if (input.hasAnd) {
      confidenceScore += 0.06;
      reasons.push('"and" author connector');
    }

    if (input.hasYearEnd) {
      confidenceScore += 0.1;
      reasons.push('year at end of entry');
    }

    if (input.hasJournalAbbrev) {
      confidenceScore += 0.05;
      reasons.push('journal abbreviation markers present');
    }

    return {
      style: 'chicago-author-date',
      family: 'author-date',
      confidenceScore: this.clampScore(confidenceScore),
      reasons,
    };
  }

  private scoreHarvard(input: {
    hasAuthorDate: boolean;
    hasAnd: boolean;
    hasInitials: boolean;
    hasDoiUrl: boolean;
  }): CitationStyleCandidate {
    let confidenceScore = 0.09;
    const reasons: string[] = [];

    if (input.hasAuthorDate) {
      confidenceScore += 0.28;
      reasons.push('author-date pattern found');
    }

    if (input.hasAnd) {
      confidenceScore += 0.1;
      reasons.push('"and" connector present');
    }

    if (input.hasInitials) {
      confidenceScore += 0.04;
      reasons.push('author initials detected');
    }

    if (!input.hasDoiUrl) {
      confidenceScore += 0.04;
      reasons.push('no DOI URL present');
    }

    return {
      style: 'harvard',
      family: 'author-date',
      confidenceScore: this.clampScore(confidenceScore),
      reasons,
    };
  }

  private scoreMla(input: {
    hasMlaMarkers: boolean;
    hasQuotedTitle: boolean;
    hasAnd: boolean;
    hasYearEnd: boolean;
  }): CitationStyleCandidate {
    let confidenceScore = 0.08;
    const reasons: string[] = [];

    if (input.hasQuotedTitle) {
      confidenceScore += 0.2;
      reasons.push('quoted title detected');
    }

    if (input.hasMlaMarkers) {
      confidenceScore += 0.3;
      reasons.push('MLA-specific markers detected');
    }

    if (input.hasAnd) {
      confidenceScore += 0.05;
      reasons.push('multi-author connector present');
    }

    if (input.hasYearEnd) {
      confidenceScore += 0.08;
      reasons.push('year appears near entry end');
    }

    return {
      style: 'mla',
      family: 'mla',
      confidenceScore: this.clampScore(confidenceScore),
      reasons,
    };
  }

  private scoreChicagoNotes(input: {
    hasNotes: boolean;
    hasYearEnd: boolean;
  }): CitationStyleCandidate {
    let confidenceScore = 0.08;
    const reasons: string[] = [];

    if (input.hasNotes) {
      confidenceScore += 0.35;
      reasons.push('notes-style markers detected');
    }

    if (input.hasYearEnd) {
      confidenceScore += 0.06;
      reasons.push('year appears near entry end');
    }

    return {
      style: 'chicago-notes-bibliography',
      family: 'notes-bibliography',
      confidenceScore: this.clampScore(confidenceScore),
      reasons,
    };
  }

  private scoreVancouver(input: {
    hasNumeric: boolean;
    hasInitials: boolean;
    hasJournalAbbrev: boolean;
    hasQuotedTitle: boolean;
  }): CitationStyleCandidate {
    let confidenceScore = 0.1;
    const reasons: string[] = [];

    if (input.hasNumeric) {
      confidenceScore += 0.35;
      reasons.push('numeric citation markers detected');
    }

    if (input.hasInitials) {
      confidenceScore += 0.08;
      reasons.push('author initials detected');
    }

    if (input.hasJournalAbbrev) {
      confidenceScore += 0.08;
      reasons.push('journal abbreviations detected');
    }

    if (!input.hasQuotedTitle) {
      confidenceScore += 0.05;
      reasons.push('no quoted article title');
    }

    return {
      style: 'vancouver',
      family: 'numeric',
      confidenceScore: this.clampScore(confidenceScore),
      reasons,
    };
  }

  private scoreIeee(input: {
    hasNumeric: boolean;
    hasQuotedTitle: boolean;
    hasJournalAbbrev: boolean;
    hasDoiUrl: boolean;
  }): CitationStyleCandidate {
    let confidenceScore = 0.08;
    const reasons: string[] = [];

    if (input.hasNumeric) {
      confidenceScore += 0.32;
      reasons.push('numeric citation markers detected');
    }

    if (input.hasQuotedTitle) {
      confidenceScore += 0.12;
      reasons.push('quoted title detected');
    }

    if (input.hasJournalAbbrev) {
      confidenceScore += 0.1;
      reasons.push('journal abbreviation detected');
    }

    if (input.hasDoiUrl) {
      confidenceScore += 0.05;
      reasons.push('DOI URL detected');
    }

    return {
      style: 'ieee',
      family: 'numeric',
      confidenceScore: this.clampScore(confidenceScore),
      reasons,
    };
  }

  private scoreMdpi(input: {
    hasNumeric: boolean;
    hasDoiUrl: boolean;
    hasInitials: boolean;
    hasJournalAbbrev: boolean;
  }): CitationStyleCandidate {
    let confidenceScore = 0.08;
    const reasons: string[] = [];

    if (input.hasNumeric) {
      confidenceScore += 0.3;
      reasons.push('numeric citation markers detected');
    }

    if (input.hasDoiUrl) {
      confidenceScore += 0.14;
      reasons.push('DOI URL detected');
    }

    if (input.hasInitials) {
      confidenceScore += 0.06;
      reasons.push('author initials detected');
    }

    if (input.hasJournalAbbrev) {
      confidenceScore += 0.05;
      reasons.push('journal abbreviations detected');
    }

    return {
      style: 'mdpi',
      family: 'numeric',
      confidenceScore: this.clampScore(confidenceScore),
      reasons,
    };
  }

  private scoreAma(input: {
    hasNumeric: boolean;
    hasInitials: boolean;
    hasJournalAbbrev: boolean;
  }): CitationStyleCandidate {
    let confidenceScore = 0.06;
    const reasons: string[] = [];

    if (input.hasNumeric) {
      confidenceScore += 0.28;
      reasons.push('numeric citation markers detected');
    }

    if (input.hasInitials) {
      confidenceScore += 0.1;
      reasons.push('author initials detected');
    }

    if (input.hasJournalAbbrev) {
      confidenceScore += 0.12;
      reasons.push('medical journal abbreviations detected');
    }

    return {
      style: 'ama',
      family: 'numeric',
      confidenceScore: this.clampScore(confidenceScore),
      reasons,
    };
  }

  private scoreNlm(input: {
    hasNumeric: boolean;
    hasInitials: boolean;
    hasJournalAbbrev: boolean;
    hasDoiPrefix: boolean;
  }): CitationStyleCandidate {
    let confidenceScore = 0.06;
    const reasons: string[] = [];

    if (input.hasNumeric) {
      confidenceScore += 0.28;
      reasons.push('numeric citation markers detected');
    }

    if (input.hasInitials) {
      confidenceScore += 0.1;
      reasons.push('author initials detected');
    }

    if (input.hasJournalAbbrev) {
      confidenceScore += 0.08;
      reasons.push('medical journal abbreviations detected');
    }

    if (input.hasDoiPrefix) {
      confidenceScore += 0.04;
      reasons.push('legacy DOI prefix detected');
    }

    return {
      style: 'nlm',
      family: 'numeric',
      confidenceScore: this.clampScore(confidenceScore),
      reasons,
    };
  }

  private clampScore(
    score: number,
    signals: CitationStyleDetectionSignal[] = [],
  ): number {
    const signalBoost = signals.reduce((total, signal) => total + signal.score * 0.02, 0);
    return Math.max(0.01, Math.min(0.99, score + signalBoost));
  }
}
