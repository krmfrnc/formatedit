import { Injectable } from '@nestjs/common';
import {
  authorDateStyles,
  numericStyles,
  notesBibliographyStyles,
  supportedCitationStyles,
  type CitationStyleSlug,
} from './citation.constants';
import type {
  CitationFamily,
  CitationParseResult,
  ParsedCitation,
} from './citation.types';

const leadingListPattern = /^(?:\[\d+\]|\d+[.)]|•|-)\s*/u;
const yearPattern = /(?<year>(?:19|20)\d{2}[a-z]?)/u;
const doiPattern = /(?:doi:\s*|https?:\/\/(?:dx\.)?doi\.org\/)(?<doi>10\.\S+)/i;
const urlPattern = /https?:\/\/[^\s)]+/i;
const volumeIssuePattern = /(?<volume>\d+)\s*(?:\((?<issue>[^)]+)\))?/;
const pagesPattern =
  /(?:,|:|;|pp?\.?|pages?)\s*(?<pages>\d+(?:\s*[-–]\s*\d+)?)/gi;

@Injectable()
export class CitationParserService {
  getSupportedStyles(): readonly CitationStyleSlug[] {
    return supportedCitationStyles;
  }

  parseBibliographyText(
    rawText: string,
    style: CitationStyleSlug,
  ): CitationParseResult {
    const family = this.resolveFamily(style);
    const entries = this.splitEntries(rawText).map((entry, index) =>
      this.parseCitationEntry(entry, style, index),
    );

    return {
      style,
      family,
      entries,
    };
  }

  parseCitationEntry(
    rawText: string,
    style: CitationStyleSlug,
    orderIndex = 0,
  ): ParsedCitation {
    const cleaned = this.cleanEntryText(rawText);
    const family = this.resolveFamily(style);
    const authorDateLike = this.parseAuthorDateEntry(cleaned);
    const numericLike = this.parseNumericEntry(cleaned);
    const notesLike = this.parseNotesBibliographyEntry(cleaned);
    const mlaLike = this.parseMlaEntry(cleaned);

    const parsed =
      (authorDateStyles.includes(style) && authorDateLike) ||
      (numericStyles.includes(style) && numericLike) ||
      (notesBibliographyStyles.includes(style) && notesLike) ||
      (style === 'mla' && mlaLike) ||
      authorDateLike ||
      numericLike ||
      notesLike ||
      mlaLike ||
      this.parseFallbackEntry(cleaned);

    return {
      ...parsed,
      orderIndex,
      style,
      family,
      rawText: cleaned,
    };
  }

  splitEntries(rawText: string): string[] {
    const normalized = rawText.replace(/\r\n/g, '\n').trim();
    if (!normalized) {
      return [];
    }

    if (normalized.includes('\n\n')) {
      return normalized
        .split(/\n{2,}/)
        .map((part) => this.cleanEntryText(part))
        .filter(Boolean);
    }

    const lines = normalized
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);

    if (lines.length <= 1) {
      return [this.cleanEntryText(normalized)];
    }

    const entries: string[] = [];
    let current = '';

    for (const line of lines) {
      const startsNewEntry =
        !current ||
        leadingListPattern.test(line) ||
        /^\p{Lu}[\p{L}\p{M}'’\-,.&\s]+,\s*/u.test(line);

      if (startsNewEntry && current) {
        entries.push(this.cleanEntryText(current));
        current = line;
        continue;
      }

      current = current ? `${current} ${line}` : line;
    }

    if (current) {
      entries.push(this.cleanEntryText(current));
    }

    return entries.filter(Boolean);
  }

  private resolveFamily(style: CitationStyleSlug): CitationFamily {
    if (authorDateStyles.includes(style)) {
      return 'author-date';
    }

    if (numericStyles.includes(style)) {
      return 'numeric';
    }

    if (notesBibliographyStyles.includes(style)) {
      return 'notes-bibliography';
    }

    if (style === 'mla') {
      return 'mla';
    }

    return 'unknown';
  }

  private parseAuthorDateEntry(rawText: string): ParsedCitation | null {
    const cleaned = rawText.replace(leadingListPattern, '').trim();
    const match = cleaned.match(
      /^(?<authors>.+?)\s+\((?<year>(?:19|20)\d{2}[a-z]?)\)\.?\s+(?<rest>.+)$/u,
    );

    if (!match?.groups) {
      return null;
    }

    const authors = this.splitAuthors(match.groups.authors);
    const year = this.extractYear(match.groups.year);
    const { sentence: title, remainder } = this.splitFirstSentence(
      match.groups.rest,
    );
    const {
      containerTitle,
      volume,
      issue,
      pages,
      publisher,
      doi,
      url,
    } = this.parseCitationBody(remainder || match.groups.rest);

    return this.buildParsedCitation({
      rawText,
      authors,
      year,
      title,
      containerTitle,
      volume,
      issue,
      pages,
      publisher,
      doi,
      url,
      note: null,
      confidenceScore: 0.92,
    });
  }

  private parseNumericEntry(rawText: string): ParsedCitation | null {
    const cleaned = rawText.replace(leadingListPattern, '').trim();
    const match = cleaned.match(
      /^(?<authors>.+?)\.\s+(?<title>.+?)\.\s+(?<rest>.+)$/u,
    );

    if (!match?.groups) {
      return null;
    }

    const authors = this.splitAuthors(match.groups.authors);
    const { year, containerTitle, volume, issue, pages, publisher, doi, url } =
      this.parseNumericBody(match.groups.rest);

    return this.buildParsedCitation({
      rawText,
      authors,
      year,
      title: this.stripQuotes(match.groups.title),
      containerTitle,
      volume,
      issue,
      pages,
      publisher,
      doi,
      url,
      note: null,
      confidenceScore: 0.88,
    });
  }

  private parseNotesBibliographyEntry(rawText: string): ParsedCitation | null {
    const cleaned = rawText.replace(leadingListPattern, '').trim();
    const match = cleaned.match(
      /^(?<authors>.+?)\.\s+(?<title>.+?)\.\s+(?<rest>.+)$/u,
    );

    if (!match?.groups) {
      return null;
    }

    const authors = this.splitAuthors(match.groups.authors);
    const { year, containerTitle, volume, issue, pages, publisher, doi, url } =
      this.parseCitationBody(match.groups.rest, true);

    return this.buildParsedCitation({
      rawText,
      authors,
      year,
      title: this.stripQuotes(match.groups.title),
      containerTitle,
      volume,
      issue,
      pages,
      publisher,
      doi,
      url,
      note: null,
      confidenceScore: 0.84,
    });
  }

  private parseMlaEntry(rawText: string): ParsedCitation | null {
    const cleaned = rawText.replace(leadingListPattern, '').trim();
    const match = cleaned.match(
      /^(?<authors>.+?)\.\s+(?<title>"[^"]+"|“[^”]+”|[^.]+?)\.\s+(?<rest>.+)$/u,
    );

    if (!match?.groups) {
      return null;
    }

    const authors = this.splitAuthors(match.groups.authors);
    const body = match.groups.rest;
    const yearMatch = body.match(yearPattern);
    const year = this.extractYear(yearMatch?.groups?.year ?? null);
    const doi = this.extractDoi(body);
    const url = this.extractUrl(body);
    const pages = this.extractPages(body);
    const containerTitle = this.extractContainerTitle(body);

    return this.buildParsedCitation({
      rawText,
      authors,
      year,
      title: this.stripQuotes(match.groups.title),
      containerTitle,
      volume: this.extractVolume(body),
      issue: this.extractIssue(body),
      pages,
      publisher: this.extractPublisher(body),
      doi,
      url,
      note: null,
      confidenceScore: 0.8,
    });
  }

  private parseFallbackEntry(rawText: string): ParsedCitation {
    const cleaned = rawText.replace(leadingListPattern, '').trim();
    const yearMatch = cleaned.match(yearPattern);

    return this.buildParsedCitation({
      rawText,
      authors: this.extractAuthorsFallback(cleaned),
      year: this.extractYear(yearMatch?.groups?.year ?? null),
      title: this.extractTitleFallback(cleaned),
      containerTitle: this.extractContainerTitle(cleaned),
      volume: this.extractVolume(cleaned),
      issue: this.extractIssue(cleaned),
      pages: this.extractPages(cleaned),
      publisher: this.extractPublisher(cleaned),
      doi: this.extractDoi(cleaned),
      url: this.extractUrl(cleaned),
      note: null,
      confidenceScore: 0.5,
    });
  }

  private parseCitationBody(
    body: string,
    allowNotesStyle = false,
  ): {
    year: number | null;
    containerTitle: string | null;
    volume: string | null;
    issue: string | null;
    pages: string | null;
    publisher: string | null;
    doi: string | null;
    url: string | null;
  } {
    const yearMatch = body.match(yearPattern);
    const year = this.extractYear(yearMatch?.groups?.year ?? null);
    const doi = this.extractDoi(body);
    const url = this.extractUrl(body);
    const pages = this.extractPages(body);
    const volume = this.extractVolume(body);
    const issue = this.extractIssue(body);
    const publisher = this.extractPublisher(body);
    const containerTitle = this.extractContainerTitle(body, allowNotesStyle);

    return {
      year,
      containerTitle,
      volume,
      issue,
      pages,
      publisher,
      doi,
      url,
    };
  }

  private parseNumericBody(
    body: string,
  ): {
    year: number | null;
    containerTitle: string | null;
    volume: string | null;
    issue: string | null;
    pages: string | null;
    publisher: string | null;
    doi: string | null;
    url: string | null;
  } {
    const yearMatch = body.match(yearPattern);
    const doi = this.extractDoi(body);
    const url = this.extractUrl(body);
    const pages = this.extractPages(body);
    const volume = this.extractVolume(body);
    const issue = this.extractIssue(body);
    const publisher = this.extractPublisher(body);
    const containerTitle = this.extractContainerTitle(body);

    return {
      year: this.extractYear(yearMatch?.groups?.year ?? null),
      containerTitle,
      volume,
      issue,
      pages,
      publisher,
      doi,
      url,
    };
  }

  private extractContainerTitle(
    body: string,
    allowNotesStyle = false,
  ): string | null {
    const normalized = body.replace(/\s+/g, ' ').trim();
    if (!normalized) {
      return null;
    }

    const cleaned = normalized
      .replace(doiPattern, '')
      .replace(urlPattern, '')
      .replace(volumeIssuePattern, '')
      .replace(pagesPattern, '')
      .trim();

    if (!cleaned) {
      return null;
    }

    const firstSegment = cleaned.split('.').map((segment) => segment.trim())[0];
    if (!firstSegment) {
      return null;
    }

    const candidate = firstSegment.split(',')[0]?.trim() ?? '';
    if (allowNotesStyle && candidate.length < 2) {
      return null;
    }

    return candidate || null;
  }

  private extractVolume(body: string): string | null {
    const match = body.match(volumeIssuePattern);
    return match?.groups?.volume?.trim() ?? null;
  }

  private extractIssue(body: string): string | null {
    const match = body.match(volumeIssuePattern);
    return match?.groups?.issue?.trim() ?? null;
  }

  private extractPages(body: string): string | null {
    const matches = [...body.matchAll(pagesPattern)];
    const lastMatch = matches.at(-1);
    return lastMatch?.groups?.pages?.replace(/\s+/g, '') ?? null;
  }

  private extractPublisher(body: string): string | null {
    const publisherMatch = body.match(
      /\b(?:publisher|press|university|institute|association|society)\b[^.,;]*/i,
    );
    return publisherMatch?.[0]?.trim() ?? null;
  }

  private extractDoi(body: string): string | null {
    const match = body.match(doiPattern);
    return match?.groups?.doi?.replace(/\s+/g, '') ?? null;
  }

  private extractUrl(body: string): string | null {
    const match = body.match(urlPattern);
    return match?.[0]?.replace(/[),.;]+$/, '') ?? null;
  }

  private extractYear(year: string | null): number | null {
    if (!year) {
      return null;
    }

    const parsedYear = Number(year.slice(0, 4));
    return Number.isFinite(parsedYear) ? parsedYear : null;
  }

  private splitAuthors(authorsText: string): string[] {
    return authorsText
      .split(/\s*(?:;| and | & )\s*/i)
      .map((author) => author.trim())
      .filter(Boolean);
  }

  private splitFirstSentence(text: string): {
    sentence: string;
    remainder: string;
  } {
    const normalized = text.replace(/\s+/g, ' ').trim();
    const splitIndex = normalized.indexOf('.');

    if (splitIndex === -1) {
      return {
        sentence: this.stripQuotes(normalized),
        remainder: '',
      };
    }

    return {
      sentence: this.stripQuotes(normalized.slice(0, splitIndex).trim()),
      remainder: normalized.slice(splitIndex + 1).trim(),
    };
  }

  private extractAuthorsFallback(rawText: string): string[] {
    const firstSentence = rawText.split('.').shift() ?? rawText;
    return this.splitAuthors(firstSentence);
  }

  private extractTitleFallback(rawText: string): string | null {
    const segments = rawText.split('.').map((segment) => segment.trim());
    if (segments.length < 2) {
      return rawText.trim() || null;
    }

    return this.stripQuotes(segments[1]) || null;
  }

  private stripQuotes(text: string): string {
    return text
      .replace(/^["“]/, '')
      .replace(/["”]$/, '')
      .replace(/^'/, '')
      .replace(/'$/, '')
      .trim();
  }

  private cleanEntryText(text: string): string {
    return text.replace(/\s+/g, ' ').trim();
  }

  private buildParsedCitation(input: {
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
  }): ParsedCitation {
    const normalizedParts = [
      input.authors.join('; '),
      input.year ? `(${input.year})` : null,
      input.title,
      input.containerTitle,
      input.volume,
      input.issue,
      input.pages,
      input.publisher,
      input.doi ? `doi:${input.doi}` : null,
      input.url,
      input.note,
    ].filter(Boolean);

    return {
      orderIndex: 0,
      style: 'apa-7',
      family: 'unknown',
      rawText: input.rawText,
      authors: input.authors,
      year: input.year,
      title: input.title,
      containerTitle: input.containerTitle,
      volume: input.volume,
      issue: input.issue,
      pages: input.pages,
      publisher: input.publisher,
      doi: input.doi,
      url: input.url,
      note: input.note,
      confidenceScore: Number(
        Math.max(
          0.05,
          Math.min(
            0.99,
            input.confidenceScore +
              (input.authors.length ? 0.04 : 0) +
              (input.year ? 0.04 : 0) +
              (input.title ? 0.04 : 0) +
              (input.doi || input.url ? 0.03 : 0),
          ),
        ).toFixed(3),
      ),
      normalizedText: normalizedParts.join(' ').replace(/\s+/g, ' ').trim(),
    };
  }
}
