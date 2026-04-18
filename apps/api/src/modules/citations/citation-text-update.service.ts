import { Injectable } from '@nestjs/common';
import {
  authorDateStyles,
  notesBibliographyStyles,
  numericStyles,
  type CitationStyleSlug,
} from './citation.constants';
import { CitationTextMatcherService } from './citation-text-matcher.service';
import type { CitationFamily, CitationParseResult, ParsedCitation } from './citation.types';
import type { CitationStyleConversionWarning } from './citation-style-conversion.types';
import type {
  CitationTextMatchItem,
  CitationTextMatchingInput,
} from './citation-text-matcher.types';
import type {
  CitationTextUpdateChange,
  CitationTextUpdateInput,
  CitationTextUpdateResult,
} from './citation-text-update.types';

interface CitationSpanGroup {
  startIndex: number;
  endIndex: number;
  sourceText: string;
  matches: CitationTextMatchItem[];
}

@Injectable()
export class CitationTextUpdateService {
  constructor(
    private readonly citationTextMatcherService: CitationTextMatcherService,
  ) {}

  updateTextCitations(
    input: CitationTextUpdateInput,
  ): CitationTextUpdateResult {
    const sourceStyle = this.resolveSourceStyle(
      input.bibliography,
      input.bibliographyStyle,
    );
    const sourceFamily = this.resolveFamily(sourceStyle);
    const targetFamily = this.resolveFamily(input.targetStyle);
    const matchResult = this.citationTextMatcherService.matchTextCitations({
      text: input.text,
      bibliography: input.bibliography,
      bibliographyStyle:
        sourceStyle === 'unknown' ? input.bibliographyStyle : sourceStyle,
    } satisfies CitationTextMatchingInput);
    const groups = this.groupMatches(input.text, matchResult.matches);
    const warnings: CitationStyleConversionWarning[] = [];
    const changes = groups.map((group) =>
      this.renderGroup(group, input.targetStyle, targetFamily, warnings),
    );
    const updatedText = this.applyChanges(input.text, changes);
    const matchedCount = groups.filter((group) =>
      group.matches.some((match) => Boolean(match.matchedCitation)),
    ).length;
    const updatedCount = changes.filter(
      (change) => !change.preserved && change.replacementText !== change.sourceText,
    ).length;
    const unmatchedCount = groups.length - matchedCount;
    const warningCount =
      warnings.length +
      changes.reduce((count, change) => count + change.warningCodes.length, 0);

    return {
      sourceStyle,
      sourceFamily,
      targetStyle: input.targetStyle,
      targetFamily,
      sourceText: input.text,
      updatedText,
      totalDetectedCount: matchResult.detectedCitations.length,
      matchedCount,
      updatedCount,
      unmatchedCount,
      approximate:
        matchedCount !== groups.length ||
        warnings.length > 0 ||
        matchResult.matches.some((match) => match.confidenceScore < 0.7),
      warningCount,
      changes,
      warnings,
    };
  }

  previewTextCitationUpdates(
    input: CitationTextUpdateInput,
    sampleSize = 5,
  ): CitationTextUpdateResult {
    const result = this.updateTextCitations(input);
    const previewLimit = Math.max(1, Math.min(sampleSize, 10));
    const limitedChanges = result.changes.slice(0, previewLimit);

    return {
      ...result,
      changes: limitedChanges,
      updatedText: this.applyChanges(result.sourceText, limitedChanges),
      approximate: result.approximate || result.changes.length > previewLimit,
    };
  }

  private renderGroup(
    group: CitationSpanGroup,
    targetStyle: CitationStyleSlug,
    targetFamily: ReturnType<CitationTextUpdateService['resolveFamily']>,
    warnings: CitationStyleConversionWarning[],
  ): CitationTextUpdateChange {
    const matchedItems = group.matches.filter((match) =>
      Boolean(match.matchedCitation),
    );

    if (!matchedItems.length) {
      warnings.push({
        code: 'CITATION_GROUP_UNMATCHED',
        severity: 'WARNING',
        message:
          'A citation span could not be matched to the bibliography and was preserved as-is.',
        fieldPath: 'rawText',
      });

      return {
        startIndex: group.startIndex,
        endIndex: group.endIndex,
        sourceText: group.sourceText,
        replacementText: group.sourceText,
        strategy: group.matches[0]?.strategy ?? 'unmatched',
        matchedCitationIds: [],
        confidenceScore: 0,
        approximate: true,
        warningCodes: ['CITATION_GROUP_UNMATCHED'],
        preserved: true,
      };
    }

    const warningCodes: string[] = [];
    const renderedParts = matchedItems.map((match) =>
      this.renderSingleCitation(match, targetStyle, targetFamily, warningCodes),
    );
    const joiner =
      targetFamily === 'numeric' || targetFamily === 'notes-bibliography'
        ? ', '
        : '; ';
    const coreText = renderedParts.join(joiner);
    const replacementText =
      targetStyle === 'ama'
        ? `^${coreText}`
        : targetFamily === 'numeric'
          ? `[${coreText}]`
          : targetFamily === 'notes-bibliography'
            ? `^${coreText}`
            : targetFamily === 'author-date'
              ? this.renderAuthorDateGroup(group, coreText)
              : this.wrapCitation(coreText, targetFamily);

    return {
      startIndex: group.startIndex,
      endIndex: group.endIndex,
      sourceText: group.sourceText,
      replacementText,
      strategy: group.matches[0]?.strategy ?? 'unmatched',
      matchedCitationIds: matchedItems
        .map((item) => item.matchedCitation)
        .filter((citation): citation is ParsedCitation => Boolean(citation))
        .map((citation) => String(citation.orderIndex)),
      confidenceScore: Number(
        (
          matchedItems.reduce((sum, item) => sum + item.confidenceScore, 0) /
          matchedItems.length
        ).toFixed(3),
      ),
      approximate:
        matchedItems.some((item) => item.confidenceScore < 0.7) ||
        warningCodes.length > 0 ||
        replacementText === group.sourceText,
      warningCodes,
      preserved: replacementText === group.sourceText,
    };
  }

  private renderSingleCitation(
    match: CitationTextMatchItem,
    targetStyle: CitationStyleSlug,
    targetFamily: ReturnType<CitationTextUpdateService['resolveFamily']>,
    warningCodes: string[],
  ): string {
    const citation = match.matchedCitation;
    if (!citation) {
      warningCodes.push('CITATION_UNMATCHED');
      return match.citation.rawText;
    }

    if (targetFamily === 'numeric') {
      return this.renderNumericCitation(citation, targetStyle, match.citation, match.citation.family);
    }

    if (targetFamily === 'notes-bibliography') {
      return this.renderNotesCitation(citation, match.citation);
    }

    if (targetFamily === 'mla') {
      return this.renderMlaCitation(citation, match.citation);
    }

    return this.renderAuthorDateCitation(citation, match.citation);
  }

  private renderAuthorDateCitation(
    citation: ParsedCitation,
    detected: CitationTextMatchItem['citation'],
  ): string {
    const narrative =
      detected.family === 'author-date' && this.isNarrativeCitation(detected.rawText);
    const authorText = this.formatAuthorNames(
      citation.authors,
      narrative ? 'narrative' : 'parenthetical',
    );
    const year = citation.year ?? 'n.d.';
    const pageText = this.formatPageReferences(detected.pageReferences);
    const suffix = pageText ? `, ${pageText}` : '';

    if (narrative) {
      return `${authorText} (${year}${suffix})`;
    }

    return `(${authorText}, ${year}${suffix})`;
  }

  private renderNumericCitation(
    citation: ParsedCitation,
    targetStyle: CitationStyleSlug,
    detected: CitationTextMatchItem['citation'],
    sourceFamily: CitationTextMatchItem['citation']['family'],
  ): string {
    const referenceText = detected.rawText;
    const numbers =
      sourceFamily === 'numeric'
        ? this.extractNumericOrderList(referenceText, citation.orderIndex + 1)
        : [citation.orderIndex + 1];

    if (
      sourceFamily === 'numeric' &&
      (targetStyle === 'ieee' ||
        targetStyle === 'mdpi' ||
        targetStyle === 'vancouver' ||
        targetStyle === 'nlm') &&
      numbers.length > 1 &&
      this.looksLikeRange(referenceText) &&
      this.isConsecutive(numbers)
    ) {
      return `${numbers[0]}-${numbers.at(-1)}`;
    }

    const formatted = numbers.join(', ');
    const locator = this.formatPageReferences(detected.pageReferences);
    const locatorSuffix = locator ? `, ${locator}` : '';

    if (targetStyle === 'ama') {
      return `${formatted}${locatorSuffix}`;
    }

    if (
      targetStyle === 'ieee' ||
      targetStyle === 'mdpi' ||
      targetStyle === 'vancouver' ||
      targetStyle === 'nlm'
    ) {
      return `${formatted}${locatorSuffix}`;
    }

    return `${formatted}${locatorSuffix}`;
  }

  private renderNotesCitation(
    citation: ParsedCitation,
    detected: CitationTextMatchItem['citation'],
  ): string {
    const locator = this.formatPageReferences(detected.pageReferences);
    return locator
      ? `${citation.orderIndex + 1}, ${locator}`
      : `${citation.orderIndex + 1}`;
  }

  private renderMlaCitation(
    citation: ParsedCitation,
    detected: CitationTextMatchItem['citation'],
  ): string {
    const surname = this.formatSurname(citation.authors[0] ?? 'Anon.');
    const locator =
      this.formatPageReferences(detected.pageReferences) ||
      (citation.year ? String(citation.year) : 'n.d.');
    return `(${surname} ${locator})`;
  }

  private renderAuthorDateGroup(
    group: CitationSpanGroup,
    coreText: string,
  ): string {
    if (!group.matches.length) {
      return coreText;
    }

    const isNarrative =
      group.matches.length === 1 &&
      this.isNarrativeCitation(group.matches[0].citation.rawText);

    if (isNarrative) {
      return coreText;
    }

    return coreText.startsWith('(') ? coreText : `(${coreText})`;
  }

  private wrapCitation(
    text: string,
    family: ReturnType<CitationTextUpdateService['resolveFamily']>,
  ): string {
    if (!text) {
      return text;
    }

    if (family === 'author-date' || family === 'mla') {
      return text.startsWith('(') ? text : `(${text})`;
    }

    if (family === 'numeric') {
      return text.startsWith('[') ? text : `[${text}]`;
    }

    return text;
  }

  private groupMatches(
    text: string,
    matches: CitationTextMatchItem[],
  ): CitationSpanGroup[] {
    const groups = new Map<string, CitationSpanGroup>();

    for (const match of matches) {
      const key = `${match.citation.startIndex}:${match.citation.endIndex}`;
      const existing = groups.get(key);

      if (existing) {
        existing.matches.push(match);
        continue;
      }

      groups.set(key, {
        startIndex: match.citation.startIndex,
        endIndex: match.citation.endIndex,
        sourceText: text.slice(match.citation.startIndex, match.citation.endIndex),
        matches: [match],
      });
    }

    return [...groups.values()].sort((left, right) => left.startIndex - right.startIndex);
  }

  private applyChanges(
    text: string,
    changes: CitationTextUpdateChange[],
  ): string {
    if (!changes.length) {
      return text;
    }

    let output = text;

    for (const change of [...changes].sort(
      (left, right) => right.startIndex - left.startIndex,
    )) {
      if (change.preserved) {
        continue;
      }

      output =
        output.slice(0, change.startIndex) +
        change.replacementText +
        output.slice(change.endIndex);
    }

    return output;
  }

  private resolveSourceStyle(
    bibliography: CitationParseResult | ParsedCitation[],
    bibliographyStyle?: CitationStyleSlug,
  ): CitationStyleSlug | 'unknown' {
    if (!Array.isArray(bibliography)) {
      return bibliography.style;
    }

    return bibliographyStyle ?? 'unknown';
  }

  private resolveFamily(
    style: CitationStyleSlug | 'unknown',
  ): CitationFamily | 'unknown' {
    if (style === 'unknown') {
      return 'unknown';
    }

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

  private isNarrativeCitation(rawText: string): boolean {
    return !rawText.trim().startsWith('(');
  }

  private formatAuthorNames(
    authors: string[],
    mode: 'narrative' | 'parenthetical',
  ): string {
    const surnames = authors
      .map((author) => this.formatSurname(author))
      .filter(Boolean);

    if (!surnames.length) {
      return 'Anon.';
    }

    if (surnames.length === 1) {
      return surnames[0];
    }

    if (surnames.length === 2) {
      return mode === 'narrative'
        ? `${surnames[0]} and ${surnames[1]}`
        : `${surnames[0]} & ${surnames[1]}`;
    }

    return `${surnames[0]} et al.`;
  }

  private formatSurname(author: string): string {
    const cleaned = author.trim();
    if (!cleaned) {
      return 'Anon.';
    }

    if (this.looksLikeCorporateAuthor(cleaned)) {
      return cleaned;
    }

    if (cleaned.includes(',')) {
      return cleaned.split(',')[0]?.trim() || cleaned;
    }

    const parts = cleaned.split(/\s+/u).filter(Boolean);
    return parts.at(-1) ?? cleaned;
  }

  private formatPageReferences(pageReferences: string[]): string {
    if (!pageReferences.length) {
      return '';
    }

    if (pageReferences.length === 1) {
      const [page] = pageReferences;
      return this.isPageRange(page) ? `pp. ${page}` : `p. ${page}`;
    }

    return `pp. ${pageReferences.join(', ')}`;
  }

  private extractNumericOrderList(
    rawText: string,
    fallbackNumber: number,
  ): number[] {
    const matches = [...rawText.matchAll(/\d+/g)]
      .map((match) => Number(match[0]))
      .filter((value) => Number.isFinite(value) && value > 0);

    return matches.length ? matches : [fallbackNumber];
  }

  private looksLikeRange(rawText: string): boolean {
    return /[-–]/u.test(rawText);
  }

  private isConsecutive(numbers: number[]): boolean {
    if (numbers.length < 2) {
      return false;
    }

    for (let index = 1; index < numbers.length; index += 1) {
      if (numbers[index] !== numbers[index - 1] + 1) {
        return false;
      }
    }

    return true;
  }

  private isPageRange(pageReference: string): boolean {
    return /[-–]/u.test(pageReference);
  }

  private looksLikeCorporateAuthor(author: string): boolean {
    return /(?:university|institute|association|society|organization|organisation|committee|group|press|center|centre|department)/i.test(
      author,
    );
  }
}
