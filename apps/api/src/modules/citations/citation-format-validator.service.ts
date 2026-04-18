import { Injectable } from '@nestjs/common';
import {
  authorDateStyles,
  notesBibliographyStyles,
  numericStyles,
  type CitationStyleSlug,
} from './citation.constants';
import type {
  CitationEntryValidationSummary,
  CitationFormatValidationIssue,
  CitationFormatValidationResult,
} from './citation-format-validator.types';
import type { CitationParseResult, ParsedCitation } from './citation.types';

const authorInitialsPattern = /\b(?:[A-Z]\.\s*){1,3}[A-Z][\p{L}'’-]+/u;
const ampersandAuthorPattern = /(?:^|,)\s*&\s+[A-Z]/;
const quotedTitlePattern = /^["“].+["”]$/;
const numericLeadingPattern = /^(?:\[\d+\]|\d+[.)])\s*/u;
const ieeePattern = /\bvol\.\s*\d+|\bno\.\s*\d+|\bpp\.\s*\d+/i;
const doiOrUrlPattern = /\b(?:doi:\s*|https?:\/\/(?:dx\.)?doi\.org\/|https?:\/\/)/i;
const noteMarkerPattern = /\b(?:ibid\.|op\. cit\.|loc\. cit\.|supra)\b/i;
const mlaInTextPattern = /\b(?:and|&)\b|\b(?:pp?|pages?)\b/i;

@Injectable()
export class CitationFormatValidatorService {
  validateFormat(
    bibliography: CitationParseResult,
  ): CitationFormatValidationResult {
    const issues: CitationFormatValidationIssue[] = [];
    const summaries: CitationEntryValidationSummary[] = [];

    bibliography.entries.forEach((entry, index) => {
      const entryIssues = this.validateEntry(entry, bibliography.style);
      issues.push(...entryIssues);
      summaries.push(this.summarizeEntry(index, entryIssues));
    });

    return {
      style: bibliography.style,
      family: bibliography.family,
      isValid: issues.every((issue) => issue.severity !== 'ERROR'),
      issues,
      summaries,
    };
  }

  validateEntry(
    entry: ParsedCitation,
    style: CitationStyleSlug,
  ): CitationFormatValidationIssue[] {
    const family = this.resolveFamily(style);
    const issues: CitationFormatValidationIssue[] = [];

    this.requireAuthors(entry, style, family, issues);
    this.requireTitle(entry, style, family, issues);
    this.requireYear(entry, style, family, issues);
    this.validateStyleSpecificRules(entry, style, family, issues);

    return issues;
  }

  private validateStyleSpecificRules(
    entry: ParsedCitation,
    style: CitationStyleSlug,
    family: CitationFormatValidationResult['family'],
    issues: CitationFormatValidationIssue[],
  ): void {
    if (authorDateStyles.includes(style)) {
      this.validateAuthorDateRules(entry, style, family, issues);
      return;
    }

    if (numericStyles.includes(style)) {
      this.validateNumericRules(entry, style, family, issues);
      return;
    }

    if (notesBibliographyStyles.includes(style)) {
      this.validateNotesRules(entry, style, family, issues);
      return;
    }

    if (style === 'mla') {
      this.validateMlaRules(entry, style, family, issues);
    }
  }

  private validateAuthorDateRules(
    entry: ParsedCitation,
    style: CitationStyleSlug,
    family: CitationFormatValidationResult['family'],
    issues: CitationFormatValidationIssue[],
  ): void {
    const raw = entry.rawText;
    const authorSegment = this.extractAuthorSegment(raw);

    if (!entry.year) {
      this.pushIssue(issues, {
        severity: 'ERROR',
        code: 'AUTHOR_DATE_YEAR_REQUIRED',
        message: 'Author-date citations must include a publication year.',
        entryIndex: entry.orderIndex,
        style,
        family,
        validationType: 'format',
        fieldPath: 'year',
        rawExcerpt: raw,
      });
    }

    const authorTokens = authorSegment.match(/[A-Z][\p{L}'’-]+,\s*[A-Z]\./gu) ?? [];

    if (authorTokens.length > 1 && !ampersandAuthorPattern.test(authorSegment)) {
      this.pushIssue(issues, {
        severity: 'WARNING',
        code: 'AUTHOR_DATE_CONNECTOR_SHOULD_USE_AMPERSAND',
        message: 'Multiple author citations should use an ampersand before the last author.',
        entryIndex: entry.orderIndex,
        style,
        family,
        validationType: 'format',
        fieldPath: 'authors',
        rawExcerpt: raw,
      });
    }

    if (quotedTitlePattern.test(entry.title ?? '') || /["“].+["”]/.test(raw)) {
      this.pushIssue(issues, {
        severity: 'WARNING',
        code: 'AUTHOR_DATE_TITLE_SHOULD_NOT_BE_QUOTED',
        message: 'Author-date citation titles are typically not wrapped in quotes.',
        entryIndex: entry.orderIndex,
        style,
        family,
        validationType: 'format',
        fieldPath: 'title',
        rawExcerpt: raw,
      });
    }

    if (entry.containerTitle && !doiOrUrlPattern.test(raw)) {
      this.pushIssue(issues, {
        severity: 'INFO',
        code: 'AUTHOR_DATE_DOI_OR_URL_RECOMMENDED',
        message: 'A DOI or URL is usually recommended for author-date entries when available.',
        entryIndex: entry.orderIndex,
        style,
        family,
        validationType: 'format',
        fieldPath: 'doi',
        rawExcerpt: raw,
      });
    }
  }

  private validateNumericRules(
    entry: ParsedCitation,
    style: CitationStyleSlug,
    family: CitationFormatValidationResult['family'],
    issues: CitationFormatValidationIssue[],
  ): void {
    const raw = entry.rawText;

    if (!numericLeadingPattern.test(raw)) {
      this.pushIssue(issues, {
        severity: 'ERROR',
        code: 'NUMERIC_BIBLIOGRAPHY_MARKER_REQUIRED',
        message: 'Numeric styles must keep a leading numeric bibliography marker.',
        entryIndex: entry.orderIndex,
        style,
        family,
        validationType: 'format',
        fieldPath: 'rawText',
        rawExcerpt: raw,
      });
    }

    if (!authorInitialsPattern.test(raw)) {
      this.pushIssue(issues, {
        severity: 'WARNING',
        code: 'NUMERIC_AUTHOR_INITIALS_RECOMMENDED',
        message: 'Numeric styles usually prefer author initials rather than full given names.',
        entryIndex: entry.orderIndex,
        style,
        family,
        validationType: 'format',
        fieldPath: 'authors',
        rawExcerpt: raw,
      });
    }

    if (entry.containerTitle && !ieeePattern.test(raw)) {
      this.pushIssue(issues, {
        severity: 'INFO',
        code: 'NUMERIC_JOURNAL_PARTS_RECOMMENDED',
        message: 'Numeric styles usually include volume, issue, and page markers for journal entries.',
        entryIndex: entry.orderIndex,
        style,
        family,
        validationType: 'format',
        fieldPath: 'volume',
        rawExcerpt: raw,
      });
    }

    if (entry.containerTitle && !doiOrUrlPattern.test(raw)) {
      this.pushIssue(issues, {
        severity: 'INFO',
        code: 'NUMERIC_DOI_OR_URL_RECOMMENDED',
        message: 'A DOI or URL is usually recommended for numeric entries when available.',
        entryIndex: entry.orderIndex,
        style,
        family,
        validationType: 'format',
        fieldPath: 'doi',
        rawExcerpt: raw,
      });
    }
  }

  private validateNotesRules(
    entry: ParsedCitation,
    style: CitationStyleSlug,
    family: CitationFormatValidationResult['family'],
    issues: CitationFormatValidationIssue[],
  ): void {
    const raw = entry.rawText;

    if (noteMarkerPattern.test(raw)) {
      this.pushIssue(issues, {
        severity: 'WARNING',
        code: 'NOTES_MARKER_SHOULD_NOT_APPEAR_IN_BIBLIOGRAPHY',
        message: 'Notes-bibliography entries should not include footnote markers like ibid. or op. cit.',
        entryIndex: entry.orderIndex,
        style,
        family,
        validationType: 'format',
        fieldPath: 'rawText',
        rawExcerpt: raw,
      });
    }

    if (!entry.year) {
      this.pushIssue(issues, {
        severity: 'WARNING',
        code: 'NOTES_YEAR_RECOMMENDED',
        message: 'Notes-bibliography entries usually include publication year information.',
        entryIndex: entry.orderIndex,
        style,
        family,
        validationType: 'format',
        fieldPath: 'year',
        rawExcerpt: raw,
      });
    }

    if (entry.containerTitle && !doiOrUrlPattern.test(raw)) {
      this.pushIssue(issues, {
        severity: 'INFO',
        code: 'NOTES_DOI_OR_URL_RECOMMENDED',
        message: 'A DOI or URL is often helpful for notes-bibliography entries when available.',
        entryIndex: entry.orderIndex,
        style,
        family,
        validationType: 'format',
        fieldPath: 'doi',
        rawExcerpt: raw,
      });
    }
  }

  private validateMlaRules(
    entry: ParsedCitation,
    style: CitationStyleSlug,
    family: CitationFormatValidationResult['family'],
    issues: CitationFormatValidationIssue[],
  ): void {
    const raw = entry.rawText;

    if (entry.year) {
      this.pushIssue(issues, {
        severity: 'INFO',
        code: 'MLA_YEAR_IS_OPTIONAL',
        message: 'MLA bibliography entries may include years, but the year is not the primary formatting cue.',
        entryIndex: entry.orderIndex,
        style,
        family,
        validationType: 'format',
        fieldPath: 'year',
        rawExcerpt: raw,
      });
    }

    if (!mlaInTextPattern.test(raw)) {
      this.pushIssue(issues, {
        severity: 'WARNING',
        code: 'MLA_PARENTHETICAL_STYLE_EXPECTED',
        message: 'MLA entries usually preserve the author/title pattern expected by MLA-style references.',
        entryIndex: entry.orderIndex,
        style,
        family,
        validationType: 'format',
        fieldPath: 'authors',
        rawExcerpt: raw,
      });
    }

    if (!entry.containerTitle && entry.pages) {
      this.pushIssue(issues, {
        severity: 'WARNING',
        code: 'MLA_CONTAINER_TITLE_RECOMMENDED',
        message: 'MLA entries commonly include the container title for journal or book chapters.',
        entryIndex: entry.orderIndex,
        style,
        family,
        validationType: 'format',
        fieldPath: 'containerTitle',
        rawExcerpt: raw,
      });
    }
  }

  private requireAuthors(
    entry: ParsedCitation,
    style: CitationStyleSlug,
    family: CitationFormatValidationResult['family'],
    issues: CitationFormatValidationIssue[],
  ): void {
    if (entry.authors.length > 0) {
      return;
    }

    this.pushIssue(issues, {
      severity: 'ERROR',
      code: 'MISSING_AUTHORS',
      message: 'Citation entries must contain at least one author.',
      entryIndex: entry.orderIndex,
      style,
      family,
      validationType: 'format',
      fieldPath: 'authors',
      rawExcerpt: entry.rawText,
    });
  }

  private requireTitle(
    entry: ParsedCitation,
    style: CitationStyleSlug,
    family: CitationFormatValidationResult['family'],
    issues: CitationFormatValidationIssue[],
  ): void {
    if (entry.title) {
      return;
    }

    this.pushIssue(issues, {
      severity: 'ERROR',
      code: 'MISSING_TITLE',
      message: 'Citation entries must contain a title.',
      entryIndex: entry.orderIndex,
      style,
      family,
      validationType: 'format',
      fieldPath: 'title',
      rawExcerpt: entry.rawText,
    });
  }

  private requireYear(
    entry: ParsedCitation,
    style: CitationStyleSlug,
    family: CitationFormatValidationResult['family'],
    issues: CitationFormatValidationIssue[],
  ): void {
    if (entry.year || style === 'mla') {
      return;
    }

    this.pushIssue(issues, {
      severity: authorDateStyles.includes(style) ? 'ERROR' : 'WARNING',
      code: 'MISSING_YEAR',
      message: 'This citation style usually expects a publication year.',
      entryIndex: entry.orderIndex,
      style,
      family,
      validationType: 'format',
      fieldPath: 'year',
      rawExcerpt: entry.rawText,
    });
  }

  private summarizeEntry(
    entryIndex: number,
    issues: CitationFormatValidationIssue[],
  ): CitationEntryValidationSummary {
    const errorCount = issues.filter((issue) => issue.severity === 'ERROR').length;
    const warningCount = issues.filter((issue) => issue.severity === 'WARNING').length;
    const infoCount = issues.filter((issue) => issue.severity === 'INFO').length;

    return {
      entryIndex,
      severity: errorCount > 0 ? 'ERROR' : warningCount > 0 ? 'WARNING' : infoCount > 0 ? 'INFO' : 'NONE',
      issueCount: issues.length,
      errorCount,
      warningCount,
      infoCount,
    };
  }

  private pushIssue(
    issues: CitationFormatValidationIssue[],
    issue: CitationFormatValidationIssue,
  ): void {
    issues.push(issue);
  }

  private extractAuthorSegment(rawText: string): string {
    const cleaned = rawText.replace(/^(?:\[\d+\]|\d+[.)]|•|-)\s*/u, '').trim();
    const yearIndex = cleaned.search(/\s+\((?:19|20)\d{2}[a-z]?\)/u);

    if (yearIndex === -1) {
      return cleaned;
    }

    return cleaned.slice(0, yearIndex).trim();
  }

  private resolveFamily(style: CitationStyleSlug): CitationFormatValidationResult['family'] {
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
}
