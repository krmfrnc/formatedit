import { Injectable } from '@nestjs/common';
import { authorDateStyles, notesBibliographyStyles, numericStyles, type CitationStyleSlug } from './citation.constants';
import type { CitationParseResult, ParsedCitation } from './citation.types';
import type {
  CitationTextMatchItem,
  CitationTextMatchingInput,
  CitationTextMatchingResult,
  DetectedInTextCitation,
} from './citation-text-matcher.types';

const parentheticalAuthorDatePattern =
  /\((?<content>[^()]*?\b(?:19|20)\d{2}[a-z]?[^()]*)\)/gu;
const narrativeAuthorDatePattern =
  /\b(?<authors>[A-Z][\p{L}'’-]+(?:\s+(?:and|&)\s+[A-Z][\p{L}'’-]+|\s+et al\.)?)\s*\((?<year>(?:19|20)\d{2}[a-z]?)\)/gu;
const numericCitationPattern =
  /\[(?<numbers>\d+(?:\s*[-–]\s*\d+)?(?:\s*,\s*\d+(?:\s*[-–]\s*\d+)?)*)\]/gu;
const mlaParentheticalPattern =
  /\((?<content>[A-Z][\p{L}'’-]+(?:\s+(?:and|&)\s+[A-Z][\p{L}'’-]+|\s+et al\.)?\s+\d+(?:\s*[-–]\s*\d+)?)\)/gu;
const noteMarkerPattern = /(?<marker>ibid\.|op\. cit\.|loc\. cit\.|supra)/giu;
const yearPattern = /(?<year>(?:19|20)\d{2}[a-z]?)/u;

interface BibliographyEntryRecord {
  entry: ParsedCitation;
  orderNumber: number;
  firstSurname: string | null;
  surnameSet: Set<string>;
  year: number | null;
}

@Injectable()
export class CitationTextMatcherService {
  detectInTextCitations(
    text: string,
    bibliographyStyle?: CitationStyleSlug,
  ): DetectedInTextCitation[] {
    const normalized = this.normalizeText(text);
    const familyHint = bibliographyStyle
      ? this.resolveFamilyHint(bibliographyStyle)
      : 'unknown';
    const detected: DetectedInTextCitation[] = [];
    let sequence = 0;

    for (const match of normalized.matchAll(parentheticalAuthorDatePattern)) {
      const content = match.groups?.content?.trim() ?? '';
      if (!content) {
        continue;
      }

      const parts = content
        .split(/\s*;\s*/)
        .map((part) => part.trim())
        .filter(Boolean);

      for (const part of parts) {
        const yearMatch = part.match(yearPattern);
        if (!yearMatch?.groups?.year) {
          continue;
        }

        const year = this.extractYear(yearMatch.groups.year);
        const authorsText = part.slice(0, yearMatch.index ?? 0).replace(/[,\s]+$/u, '');
        const locatorText = part
          .slice((yearMatch.index ?? 0) + yearMatch[0].length)
          .trim();
        const pageReferences = this.extractPageReferences(locatorText);
        const authors = this.extractAuthorTokens(authorsText);

        if (!authors.length && year === null) {
          continue;
        }

        detected.push({
          id: `citation_${sequence++}`,
          rawText: `(${part})`,
          styleHint: bibliographyStyle ?? 'unknown',
          family: familyHint,
          startIndex: match.index ?? 0,
          endIndex: (match.index ?? 0) + (match[0]?.length ?? 0),
          authors,
          year,
          pageReferences,
          citationNumbers: [],
          noteMarker: null,
        });
      }
    }

    for (const match of normalized.matchAll(narrativeAuthorDatePattern)) {
      const authorsText = match.groups?.authors?.trim() ?? '';
      const year = this.extractYear(match.groups?.year ?? null);
      const authors = this.extractAuthorTokens(authorsText);

      if (!authors.length && year === null) {
        continue;
      }

      detected.push({
        id: `citation_${sequence++}`,
        rawText: match[0],
        styleHint: bibliographyStyle ?? 'unknown',
        family: familyHint,
        startIndex: match.index ?? 0,
        endIndex: (match.index ?? 0) + (match[0]?.length ?? 0),
        authors,
        year,
        pageReferences: [],
        citationNumbers: [],
        noteMarker: null,
      });
    }

    for (const match of normalized.matchAll(numericCitationPattern)) {
      const numbersText = match.groups?.numbers?.trim() ?? '';
      const numbers = this.expandNumericReferences(numbersText);
      if (!numbers.length) {
        continue;
      }

      for (const citationNumber of numbers) {
        detected.push({
          id: `citation_${sequence++}`,
          rawText: match[0],
          styleHint: bibliographyStyle ?? 'unknown',
          family: familyHint,
          startIndex: match.index ?? 0,
          endIndex: (match.index ?? 0) + (match[0]?.length ?? 0),
          authors: [],
          year: null,
          pageReferences: [],
          citationNumbers: [citationNumber],
          noteMarker: null,
        });
      }
    }

    for (const match of normalized.matchAll(mlaParentheticalPattern)) {
      const content = match.groups?.content?.trim() ?? '';
      if (!content || /(?:\b(?:19|20)\d{2}[a-z]?\b)/u.test(content)) {
        continue;
      }

      const firstSpace = content.search(/\s/);
      if (firstSpace === -1) {
        continue;
      }

      const authorText = content.slice(0, firstSpace).trim();
      const pageText = content.slice(firstSpace + 1).trim();
      const authors = this.extractAuthorTokens(authorText);
      const pageReferences = this.extractPageReferences(pageText);

      if (!authors.length || !pageReferences.length) {
        continue;
      }

      detected.push({
        id: `citation_${sequence++}`,
        rawText: match[0],
        styleHint: 'mla',
        family: 'mla',
        startIndex: match.index ?? 0,
        endIndex: (match.index ?? 0) + (match[0]?.length ?? 0),
        authors,
        year: null,
        pageReferences,
        citationNumbers: [],
        noteMarker: null,
      });
    }

    for (const match of normalized.matchAll(noteMarkerPattern)) {
      const marker = match.groups?.marker ?? null;
      if (!marker) {
        continue;
      }

      detected.push({
        id: `citation_${sequence++}`,
        rawText: match[0],
        styleHint: bibliographyStyle ?? 'unknown',
        family: familyHint,
        startIndex: match.index ?? 0,
        endIndex: (match.index ?? 0) + (match[0]?.length ?? 0),
        authors: [],
        year: null,
        pageReferences: [],
        citationNumbers: [],
        noteMarker: marker.toLowerCase(),
      });
    }

    const sorted = detected.sort((left, right) => {
      if (left.startIndex !== right.startIndex) {
        return left.startIndex - right.startIndex;
      }

      return right.endIndex - left.endIndex;
    });

    return this.dedupeOverlappingCitations(sorted);
  }

  matchTextCitations(
    input: CitationTextMatchingInput,
  ): CitationTextMatchingResult {
    const bibliographyEntries = this.normalizeBibliography(input.bibliography);
    const bibliographyStyle = this.resolveBibliographyStyle(
      input.bibliography,
      input.bibliographyStyle,
    );
    const detectedCitations = this.detectInTextCitations(
      input.text,
      bibliographyStyle,
    );
    const bibliographyLookup = this.buildBibliographyLookup(bibliographyEntries);
    const matches: CitationTextMatchItem[] = [];
    const matchedCitationIds = new Set<string>();
    const matchedBibliographyOrderNumbers = new Set<number>();
    let lastMatchedCitation: ParsedCitation | null = null;

    for (const citation of detectedCitations) {
      const match = this.matchCitation(
        citation,
        bibliographyLookup,
        lastMatchedCitation,
      );

      matches.push(match);

      if (match.matchedCitation) {
        const matchedReferenceId = this.getBibliographyReferenceId(match.matchedCitation);
        matchedCitationIds.add(matchedReferenceId);
        matchedBibliographyOrderNumbers.add(match.matchedCitation.orderIndex);
        lastMatchedCitation = match.matchedCitation;
      }
    }

    const unmatchedBibliographyEntries = bibliographyEntries.filter(
      (entry) => !matchedBibliographyOrderNumbers.has(entry.orderIndex),
    );

    return {
      detectedCitations,
      matches,
      matchedCitationIds: Array.from(matchedCitationIds),
      unmatchedBibliographyEntries,
      coverage: {
        detectedCount: detectedCitations.length,
        matchedCount: matches.filter((match) => Boolean(match.matchedCitation)).length,
        bibliographyCount: bibliographyEntries.length,
        matchedBibliographyCount: matchedBibliographyOrderNumbers.size,
      },
    };
  }

  private matchCitation(
    citation: DetectedInTextCitation,
    bibliographyLookup: BibliographyEntryRecord[],
    lastMatchedCitation: ParsedCitation | null,
  ): CitationTextMatchItem {
    const strategy =
      citation.family === 'numeric'
        ? 'numeric-order'
        : citation.family === 'mla'
          ? 'mla-surname'
          : citation.noteMarker
            ? 'notes-reuse'
            : 'author-year';

    if (strategy === 'numeric-order') {
      const matchedCitation = this.matchNumericCitation(
        citation,
        bibliographyLookup,
      );

      return {
        citation,
        matchedCitation,
        strategy,
        confidenceScore: matchedCitation ? 0.98 : 0.1,
      };
    }

    if (strategy === 'notes-reuse') {
      const matchedCitation = this.matchNotesCitation(
        citation,
        bibliographyLookup,
        lastMatchedCitation,
      );

      return {
        citation,
        matchedCitation,
        strategy,
        confidenceScore: matchedCitation ? 0.7 : 0.1,
      };
    }

    if (strategy === 'mla-surname') {
      const matchedCitation = this.matchMlaCitation(
        citation,
        bibliographyLookup,
      );

      return {
        citation,
        matchedCitation,
        strategy,
        confidenceScore: matchedCitation ? 0.82 : 0.15,
      };
    }

    const matchedCitation = this.matchAuthorYearCitation(
      citation,
      bibliographyLookup,
    );

    return {
      citation,
      matchedCitation,
      strategy: matchedCitation ? strategy : 'unmatched',
      confidenceScore: matchedCitation ? 0.94 : 0.12,
    };
  }

  private matchAuthorYearCitation(
    citation: DetectedInTextCitation,
    bibliographyLookup: BibliographyEntryRecord[],
  ): ParsedCitation | null {
    const year = citation.year;
    if (!year) {
      return null;
    }

    const citationAuthors = citation.authors.filter(Boolean);
    if (!citationAuthors.length) {
      return null;
    }

    const firstSurname = this.normalizeName(citationAuthors[0]);
    const candidateEntries = bibliographyLookup.filter((entry) => entry.year === year);
    if (!candidateEntries.length) {
      return null;
    }

    const exactMatches = candidateEntries.filter((entry) =>
      entry.surnameSet.has(firstSurname),
    );
    if (exactMatches.length === 1) {
      return exactMatches[0].entry;
    }

    if (exactMatches.length > 1) {
      return this.pickBestBibliographyEntry(exactMatches);
    }

    if (citationAuthors.some((author) => /et al\.?/i.test(author))) {
      const etAlMatches = candidateEntries.filter((entry) =>
        entry.firstSurname === firstSurname,
      );
      return this.pickBestBibliographyEntry(etAlMatches);
    }

    if (citationAuthors.length > 1) {
      const multiAuthorMatches = candidateEntries.filter((entry) =>
        citationAuthors.every((author) => entry.surnameSet.has(this.normalizeName(author))),
      );
      return this.pickBestBibliographyEntry(multiAuthorMatches);
    }

    return this.pickBestBibliographyEntry(candidateEntries);
  }

  private matchNumericCitation(
    citation: DetectedInTextCitation,
    bibliographyLookup: BibliographyEntryRecord[],
  ): ParsedCitation | null {
    const number = citation.citationNumbers[0];
    if (!number) {
      return null;
    }

    return bibliographyLookup.find((entry) => entry.orderNumber === number)?.entry ?? null;
  }

  private matchNotesCitation(
    citation: DetectedInTextCitation,
    bibliographyLookup: BibliographyEntryRecord[],
    lastMatchedCitation: ParsedCitation | null,
  ): ParsedCitation | null {
    if (citation.noteMarker && lastMatchedCitation) {
      return lastMatchedCitation;
    }

    return this.pickBestBibliographyEntry(
      bibliographyLookup.filter((entry) => Boolean(entry.year)),
    );
  }

  private matchMlaCitation(
    citation: DetectedInTextCitation,
    bibliographyLookup: BibliographyEntryRecord[],
  ): ParsedCitation | null {
    const surname = this.normalizeName(citation.authors[0] ?? '');
    if (!surname) {
      return null;
    }

    const candidates = bibliographyLookup.filter((entry) =>
      entry.surnameSet.has(surname) || entry.firstSurname === surname,
    );
    return this.pickBestBibliographyEntry(candidates);
  }

  private buildBibliographyLookup(
    entries: ParsedCitation[],
  ): BibliographyEntryRecord[] {
    return entries.map((entry, index) => {
      const surnames = entry.authors
        .map((author) => this.extractSurname(author))
        .filter((surname): surname is string => Boolean(surname))
        .map((surname) => this.normalizeName(surname));

      return {
        entry,
        orderNumber: index + 1,
        firstSurname: surnames[0] ?? null,
        surnameSet: new Set(surnames),
        year: entry.year,
      };
    });
  }

  private pickBestBibliographyEntry(
    entries: BibliographyEntryRecord[],
  ): ParsedCitation | null {
    if (!entries.length) {
      return null;
    }

    return [...entries].sort((left, right) => {
      if (left.entry.confidenceScore !== right.entry.confidenceScore) {
        return right.entry.confidenceScore - left.entry.confidenceScore;
      }

      return left.orderNumber - right.orderNumber;
    })[0]?.entry ?? null;
  }

  private normalizeBibliography(
    bibliography: CitationParseResult | ParsedCitation[],
  ): ParsedCitation[] {
    return Array.isArray(bibliography)
      ? bibliography
      : [...bibliography.entries];
  }

  private resolveBibliographyStyle(
    bibliography: CitationParseResult | ParsedCitation[],
    fallback?: CitationStyleSlug,
  ): CitationStyleSlug | undefined {
    if (!Array.isArray(bibliography)) {
      return bibliography.style;
    }

    return fallback;
  }

  private resolveFamilyHint(
    style: CitationStyleSlug,
  ): DetectedInTextCitation['family'] {
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

  private normalizeText(text: string): string {
    return text.replace(/\r\n/g, '\n').trim();
  }

  private extractAuthorTokens(authorsText: string): string[] {
    const normalized = authorsText
      .replace(/\b(?:et al\.?|etc\.)$/iu, '')
      .replace(/\b(?:and|&)\b/giu, ';')
      .replace(/\s+/g, ' ')
      .trim();

    if (!normalized) {
      return [];
    }

    return normalized
      .split(/\s*;\s*|\s*,\s*/u)
      .map((token) => token.trim())
      .filter(Boolean)
      .map((token) => token.replace(/\b(?:et al\.?|et al)\b/iu, '').trim())
      .filter(Boolean);
  }

  private extractSurname(author: string): string | null {
    const cleaned = author.replace(/[()]/g, '').replace(/\[/g, '').replace(/\]/g, '').trim();
    if (!cleaned) {
      return null;
    }

    if (cleaned.includes(',')) {
      const [surname] = cleaned.split(',');
      return surname?.trim() || null;
    }

    const parts = cleaned.split(/\s+/).filter(Boolean);
    return parts.at(-1) ?? null;
  }

  private getBibliographyReferenceId(entry: ParsedCitation): string {
    return String(entry.orderIndex);
  }

  private dedupeOverlappingCitations(
    citations: DetectedInTextCitation[],
  ): DetectedInTextCitation[] {
    const deduped: DetectedInTextCitation[] = [];

    for (const citation of citations) {
      const previous = deduped.at(-1);
      if (
        previous &&
        citation.startIndex >= previous.startIndex &&
        citation.endIndex <= previous.endIndex
        && (citation.startIndex > previous.startIndex || citation.endIndex < previous.endIndex)
      ) {
        continue;
      }

      deduped.push(citation);
    }

    return deduped;
  }

  private normalizeName(value: string): string {
    return value
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '')
      .trim();
  }

  private extractYear(year: string | null): number | null {
    if (!year) {
      return null;
    }

    const parsedYear = Number(year.slice(0, 4));
    return Number.isFinite(parsedYear) ? parsedYear : null;
  }

  private extractPageReferences(text: string): string[] {
    const matches = [
      ...text.matchAll(/\b(?:p{1,2}\.?\s*)?(?<page>\d+(?:\s*[-–]\s*\d+)?)/giu),
    ];

    return matches
      .map((match) => match.groups?.page?.replace(/\s+/g, '') ?? '')
      .filter(Boolean);
  }

  private expandNumericReferences(referenceText: string): number[] {
    const numbers: number[] = [];

    for (const chunk of referenceText.split(/\s*,\s*/u)) {
      const rangeMatch = chunk.match(/^(?<start>\d+)\s*[-–]\s*(?<end>\d+)$/u);
      if (rangeMatch?.groups) {
        const start = Number(rangeMatch.groups.start);
        const end = Number(rangeMatch.groups.end);
        if (Number.isFinite(start) && Number.isFinite(end) && end >= start) {
          for (let value = start; value <= end; value += 1) {
            numbers.push(value);
          }
        }
        continue;
      }

      const numericValue = Number(chunk.trim());
      if (Number.isFinite(numericValue) && numericValue > 0) {
        numbers.push(numericValue);
      }
    }

    return numbers;
  }
}
