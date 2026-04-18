import { Injectable } from '@nestjs/common';
import {
  authorDateStyles,
  notesBibliographyStyles,
  numericStyles,
  type CitationStyleSlug,
} from './citation.constants';
import { CitationParserService } from './citation-parser.service';
import type {
  CitationFamily,
  CitationParseResult,
  ParsedCitation,
} from './citation.types';
import type {
  CitationStyleConversionEntry,
  CitationStyleConversionResult,
  CitationStyleConversionSegment,
  CitationStyleConversionWarning,
} from './citation-style-conversion.types';
import type {
  CitationStyleConversionPreviewEntry,
  CitationStyleConversionPreviewResult,
} from './citation-style-conversion-preview.types';

@Injectable()
export class CitationStyleConversionService {
  constructor(private readonly citationParserService: CitationParserService) {}

  convertBibliographyText(
    rawText: string,
    sourceStyle: CitationStyleSlug,
    targetStyle: CitationStyleSlug,
  ): CitationStyleConversionResult {
    const parsed = this.citationParserService.parseBibliographyText(
      rawText,
      sourceStyle,
    );

    return this.convertBibliography(parsed, targetStyle);
  }

  convertBibliography(
    bibliography: CitationParseResult | ParsedCitation[],
    targetStyle: CitationStyleSlug,
    sourceStyle?: CitationStyleSlug,
  ): CitationStyleConversionResult {
    const normalized = this.normalizeBibliography(bibliography, sourceStyle);
    const targetFamily = this.resolveFamily(targetStyle);
    const convertedEntries = normalized.entries.map((entry, index) =>
      this.convertEntry(entry, targetStyle, index),
    );
    const warningCount = convertedEntries.reduce(
      (count, entry) => count + entry.warnings.length,
      0,
    );

    return {
      sourceStyle: normalized.sourceStyle,
      sourceFamily: normalized.sourceFamily,
      targetStyle,
      targetFamily,
      mode:
        normalized.sourceFamily === targetFamily
          ? 'same-family'
          : normalized.sourceFamily === 'unknown'
            ? 'fallback'
            : 'cross-family',
      entryCount: normalized.entries.length,
      convertedCount: convertedEntries.length,
      approximate:
        convertedEntries.some((entry) => entry.approximate) ||
        normalized.sourceFamily === 'unknown' ||
        targetFamily === 'unknown',
      warningCount,
      entries: convertedEntries,
      bibliographyText: convertedEntries
        .map((entry) => entry.convertedText)
        .join('\n\n'),
    };
  }

  previewBibliography(
    bibliography: CitationParseResult | ParsedCitation[],
    targetStyle: CitationStyleSlug,
    sourceStyle?: CitationStyleSlug,
    sampleSize = 3,
  ): CitationStyleConversionPreviewResult {
    const conversion = this.convertBibliography(
      bibliography,
      targetStyle,
      sourceStyle,
    );
    const previewLimit = Math.max(1, Math.min(sampleSize, 10));
    const previewEntries = conversion.entries
      .slice(0, previewLimit)
      .map((entry, index) => this.buildPreviewEntry(entry, index));

    return {
      sourceStyle: conversion.sourceStyle,
      sourceFamily: conversion.sourceFamily,
      targetStyle: conversion.targetStyle,
      targetFamily: conversion.targetFamily,
      mode: conversion.mode,
      totalEntries: conversion.entryCount,
      sampleSize: previewLimit,
      truncated: conversion.entryCount > previewLimit,
      approximate: conversion.approximate,
      warningCount: conversion.warningCount,
      previewEntries,
      summary: this.buildPreviewSummary(conversion.entryCount, previewLimit),
      previewText: previewEntries.map((entry) => entry.convertedText).join('\n\n'),
    };
  }

  convertEntry(
    entry: ParsedCitation,
    targetStyle: CitationStyleSlug,
    entryIndex = entry.orderIndex,
  ): CitationStyleConversionEntry {
    const sourceFamily = entry.family;
    const targetFamily = this.resolveFamily(targetStyle);
    const warnings: CitationStyleConversionWarning[] = [];
    const segments: CitationStyleConversionSegment[] = [];

    const renderedText = this.renderEntry(
      entry,
      targetStyle,
      entryIndex,
      segments,
      warnings,
    );

    const approximate = warnings.length > 0 || entry.confidenceScore < 0.7;

    return {
      entryIndex,
      sourceStyle: entry.style,
      targetStyle,
      sourceFamily,
      targetFamily,
      sourceText: entry.rawText,
      convertedText: renderedText,
      segments,
      warnings,
      approximate,
      confidenceScore: this.calculateConfidenceScore(entry, approximate),
    };
  }

  private normalizeBibliography(
    bibliography: CitationParseResult | ParsedCitation[],
    sourceStyle?: CitationStyleSlug,
  ): {
    entries: ParsedCitation[];
    sourceStyle: CitationStyleSlug;
    sourceFamily: CitationFamily;
  } {
    if (!Array.isArray(bibliography)) {
      return {
        entries: [...bibliography.entries],
        sourceStyle: bibliography.style,
        sourceFamily: bibliography.family,
      };
    }

    if (!sourceStyle) {
      throw new Error(
        'sourceStyle is required when converting a raw citation array.',
      );
    }

    return {
      entries: [...bibliography],
      sourceStyle,
      sourceFamily: this.resolveFamily(sourceStyle),
    };
  }

  private buildPreviewEntry(
    entry: CitationStyleConversionEntry,
    previewIndex: number,
  ): CitationStyleConversionPreviewEntry {
    return {
      ...entry,
      previewIndex,
    };
  }

  private buildPreviewSummary(
    totalEntries: number,
    sampleSize: number,
  ): string {
    if (totalEntries === 0) {
      return 'Önizlenecek kaynakça girişi bulunamadı.';
    }

    const shownCount = Math.min(totalEntries, sampleSize);
    const shownLabel = shownCount === 1 ? '1 örnek kaynak' : `${shownCount} örnek kaynak`;
    const totalLabel = totalEntries === 1 ? '1 kaynak' : `${totalEntries} kaynak`;

    if (shownCount === totalEntries) {
      return `${totalLabel} dönüştürme sonrası böyle görünecek.`;
    }

    return `${shownLabel} dönüştürme sonrası böyle görünecek. Toplam ${totalLabel} içinde ilk ${shownCount} tanesi gösteriliyor.`;
  }

  private renderEntry(
    entry: ParsedCitation,
    targetStyle: CitationStyleSlug,
    entryIndex: number,
    segments: CitationStyleConversionSegment[],
    warnings: CitationStyleConversionWarning[],
  ): string {
    if (authorDateStyles.includes(targetStyle)) {
      return this.renderAuthorDateEntry(
        entry,
        targetStyle,
        segments,
        warnings,
      );
    }

    if (numericStyles.includes(targetStyle)) {
      return this.renderNumericEntry(
        entry,
        targetStyle,
        entryIndex,
        segments,
        warnings,
      );
    }

    if (notesBibliographyStyles.includes(targetStyle)) {
      return this.renderNotesBibliographyEntry(
        entry,
        targetStyle,
        segments,
        warnings,
      );
    }

    if (targetStyle === 'mla') {
      return this.renderMlaEntry(entry, targetStyle, segments, warnings);
    }

    warnings.push({
      code: 'CITATION_STYLE_FALLBACK',
      severity: 'INFO',
      message:
        'Target style was not recognized; falling back to a neutral bibliography rendering.',
    });

    return this.renderAuthorDateEntry(
      entry,
      targetStyle,
      segments,
      warnings,
    );
  }

  private renderAuthorDateEntry(
    entry: ParsedCitation,
    targetStyle: CitationStyleSlug,
    segments: CitationStyleConversionSegment[],
    warnings: CitationStyleConversionWarning[],
  ): string {
    const authors = this.formatAuthorList(entry.authors, targetStyle, 'author-date');
    if (authors) {
      segments.push({ kind: 'authors', text: authors });
    } else {
      warnings.push({
        code: 'CITATION_CONVERSION_AUTHORS_MISSING',
        severity: 'WARNING',
        fieldPath: 'authors',
        message:
          'Citation authors could not be recovered confidently, so the converted entry omits the author block.',
      });
    }

    const year = entry.year ? `(${entry.year}).` : '(n.d.).';
    if (!entry.year) {
      warnings.push({
        code: 'CITATION_CONVERSION_YEAR_MISSING',
        severity: 'INFO',
        fieldPath: 'year',
        message:
          'Publication year was missing, so the conversion uses a neutral n.d. marker.',
      });
    }
    segments.push({ kind: 'year', text: year });

    const title = this.formatTitleSegment(entry, false);
    if (title) {
      segments.push({ kind: 'title', text: title });
    } else {
      warnings.push({
        code: 'CITATION_CONVERSION_TITLE_MISSING',
        severity: 'WARNING',
        fieldPath: 'title',
        message:
          'Citation title could not be recovered confidently, so the converted entry omits the title block.',
      });
    }

    const body = this.renderSourceBody(entry, 'author-date');
    if (body) {
      segments.push({ kind: 'container', text: body, emphasis: Boolean(entry.containerTitle) });
    }

    const locator = this.formatLocator(entry, targetStyle);
    if (locator) {
      segments.push({ kind: 'locator', text: locator });
    }

    return this.joinSegments(segments);
  }

  private renderNumericEntry(
    entry: ParsedCitation,
    targetStyle: CitationStyleSlug,
    entryIndex: number,
    segments: CitationStyleConversionSegment[],
    warnings: CitationStyleConversionWarning[],
  ): string {
    const prefix = this.formatNumericPrefix(targetStyle, entryIndex);
    segments.push({ kind: 'prefix', text: prefix });

    const authors = this.formatAuthorList(entry.authors, targetStyle, 'numeric');
    if (authors) {
      segments.push({ kind: 'authors', text: authors });
    } else {
      warnings.push({
        code: 'CITATION_CONVERSION_AUTHORS_MISSING',
        severity: 'WARNING',
        fieldPath: 'authors',
        message:
          'Citation authors could not be recovered confidently, so the converted entry omits the author block.',
      });
    }

    const title = this.formatTitleSegment(entry, false);
    if (title) {
      segments.push({ kind: 'title', text: title });
    } else {
      warnings.push({
        code: 'CITATION_CONVERSION_TITLE_MISSING',
        severity: 'WARNING',
        fieldPath: 'title',
        message:
          'Citation title could not be recovered confidently, so the converted entry omits the title block.',
      });
    }

    const body = this.renderSourceBody(entry, 'numeric');
    if (body) {
      segments.push({ kind: 'container', text: body, emphasis: Boolean(entry.containerTitle) });
    }

    const locator = this.formatLocator(entry, targetStyle);
    if (locator) {
      segments.push({ kind: 'locator', text: locator });
    }

    return this.joinSegments(segments);
  }

  private renderNotesBibliographyEntry(
    entry: ParsedCitation,
    targetStyle: CitationStyleSlug,
    segments: CitationStyleConversionSegment[],
    warnings: CitationStyleConversionWarning[],
  ): string {
    const authors = this.formatAuthorList(entry.authors, targetStyle, 'notes-bibliography');
    if (authors) {
      segments.push({ kind: 'authors', text: authors });
    } else {
      warnings.push({
        code: 'CITATION_CONVERSION_AUTHORS_MISSING',
        severity: 'WARNING',
        fieldPath: 'authors',
        message:
          'Citation authors could not be recovered confidently, so the converted entry omits the author block.',
      });
    }

    const title = this.formatTitleSegment(entry, Boolean(entry.containerTitle));
    if (title) {
      segments.push({
        kind: 'title',
        text: title,
        quoted: Boolean(entry.containerTitle),
      });
    } else {
      warnings.push({
        code: 'CITATION_CONVERSION_TITLE_MISSING',
        severity: 'WARNING',
        fieldPath: 'title',
        message:
          'Citation title could not be recovered confidently, so the converted entry omits the title block.',
      });
    }

    const body = this.renderSourceBody(entry, 'notes-bibliography');
    if (body) {
      segments.push({ kind: 'container', text: body, emphasis: Boolean(entry.containerTitle) });
    }

    const locator = this.formatLocator(entry, targetStyle);
    if (locator) {
      segments.push({ kind: 'locator', text: locator });
    }

    return this.joinSegments(segments);
  }

  private renderMlaEntry(
    entry: ParsedCitation,
    targetStyle: CitationStyleSlug,
    segments: CitationStyleConversionSegment[],
    warnings: CitationStyleConversionWarning[],
  ): string {
    const authors = this.formatAuthorList(entry.authors, targetStyle, 'mla');
    if (authors) {
      segments.push({ kind: 'authors', text: authors });
    } else {
      warnings.push({
        code: 'CITATION_CONVERSION_AUTHORS_MISSING',
        severity: 'WARNING',
        fieldPath: 'authors',
        message:
          'Citation authors could not be recovered confidently, so the converted entry omits the author block.',
      });
    }

    const title = this.formatTitleSegment(entry, Boolean(entry.containerTitle));
    if (title) {
      segments.push({
        kind: 'title',
        text: title,
        quoted: Boolean(entry.containerTitle),
      });
    } else {
      warnings.push({
        code: 'CITATION_CONVERSION_TITLE_MISSING',
        severity: 'WARNING',
        fieldPath: 'title',
        message:
          'Citation title could not be recovered confidently, so the converted entry omits the title block.',
      });
    }

    const body = this.renderSourceBody(entry, 'mla');
    if (body) {
      segments.push({ kind: 'container', text: body, emphasis: Boolean(entry.containerTitle) });
    }

    const locator = this.formatLocator(entry, targetStyle);
    if (locator) {
      segments.push({ kind: 'locator', text: locator });
    }

    return this.joinSegments(segments);
  }

  private renderSourceBody(
    entry: ParsedCitation,
    family: CitationFamily,
  ): string | null {
    if (entry.containerTitle) {
      return this.formatContainerBody(entry, family);
    }

    if (entry.publisher) {
      if (family === 'numeric') {
        const yearText = entry.year ? `${entry.year}.` : 'n.d.';
        return `${entry.publisher}. ${yearText}`.trim();
      }

      if (family === 'mla') {
        const yearText = entry.year ? `${entry.year}.` : 'n.d.';
        return `${entry.publisher}, ${yearText}`.trim();
      }

      return `${entry.publisher}.`;
    }

    return entry.year && family === 'numeric' ? `${entry.year}.` : null;
  }

  private formatContainerBody(
    entry: ParsedCitation,
    family: CitationFamily,
  ): string {
    const container = entry.containerTitle ?? '';
    const volume = entry.volume ? `${entry.volume}` : '';
    const issue = entry.issue ? `(${entry.issue})` : '';
    const year = entry.year ? `${entry.year}` : 'n.d.';

    if (family === 'mla') {
      const parts = [container];
      if (entry.volume) {
        parts.push(`vol. ${entry.volume}`);
      }
      if (entry.issue) {
        parts.push(`no. ${entry.issue}`);
      }
      parts.push(year);
      if (entry.pages) {
        parts.push(`pp. ${entry.pages}`);
      }
      return `${parts.join(', ')}.`;
    }

    if (family === 'numeric') {
      const detail = [year, volume + issue, entry.pages ? `${entry.pages}` : null]
        .filter(Boolean)
        .join(';');
      return `${container}. ${detail}.`;
    }

    if (family === 'notes-bibliography') {
      const detailParts = [year];
      if (entry.volume) {
        detailParts.push(`vol. ${entry.volume}`);
      }
      if (entry.issue) {
        detailParts.push(`no. ${entry.issue}`);
      }
      if (entry.pages) {
        detailParts.push(`pp. ${entry.pages}`);
      }
      return `${container}. ${detailParts.join(', ')}.`;
    }

    const detailParts = [];
    if (entry.volume) {
      detailParts.push(entry.volume + issue);
    }
    if (entry.pages) {
      detailParts.push(entry.pages);
    }

    const detail = detailParts.length ? `, ${detailParts.join(', ')}` : '';
    return `${container}${detail}.`;
  }

  private formatAuthorList(
    authors: string[],
    targetStyle: CitationStyleSlug,
    family: CitationFamily,
  ): string | null {
    const formattedAuthors = authors
      .map((author, index) =>
        this.formatSingleAuthor(author, family, index === 0),
      )
      .filter(Boolean) as string[];

    if (!formattedAuthors.length) {
      return null;
    }

    const separator = family === 'mla' || family === 'notes-bibliography' ? ', ' : ', ';
    const finalJoiner =
      family === 'author-date'
        ? targetStyle === 'harvard' || targetStyle === 'chicago-author-date'
          ? ' and '
          : ', & '
        : family === 'numeric'
          ? ', '
          : ', and ';

    if (formattedAuthors.length === 1) {
      return formattedAuthors[0];
    }

    if (formattedAuthors.length === 2) {
      return `${formattedAuthors[0]}${finalJoiner}${formattedAuthors[1]}`;
    }

    return `${formattedAuthors.slice(0, -1).join(separator)}${finalJoiner}${formattedAuthors.at(-1)}`;
  }

  private formatSingleAuthor(
    author: string,
    family: CitationFamily,
    isFirstAuthor: boolean,
  ): string | null {
    const cleaned = this.cleanWhitespace(author);
    if (!cleaned) {
      return null;
    }

    if (this.isCorporateAuthor(cleaned)) {
      return cleaned;
    }

    const { surname, givenNames } = this.splitAuthorName(cleaned);
    if (!surname && !givenNames) {
      return cleaned;
    }

    if (family === 'author-date') {
      const initials = this.extractInitials(givenNames);
      return initials ? `${surname ?? cleaned}, ${initials}` : surname ?? cleaned;
    }

    if (family === 'numeric') {
      const initials = this.extractInitials(givenNames);
      return initials ? `${surname ?? cleaned} ${initials.replace(/\s+/g, '')}` : surname ?? cleaned;
    }

    if (family === 'notes-bibliography') {
      const formattedGiven = this.normalizeGivenName(givenNames);
      return formattedGiven ? `${surname ?? cleaned}, ${formattedGiven}` : surname ?? cleaned;
    }

    if (family === 'mla') {
      const formattedGiven = this.normalizeGivenName(givenNames);
      if (isFirstAuthor) {
        return formattedGiven ? `${surname ?? cleaned}, ${formattedGiven}` : surname ?? cleaned;
      }

      return formattedGiven ? `${formattedGiven} ${surname ?? cleaned}` : surname ?? cleaned;
    }

    return cleaned;
  }

  private formatTitleSegment(
    entry: ParsedCitation,
    quoted: boolean,
  ): string | null {
    const title = this.cleanWhitespace(entry.title ?? '');
    if (!title) {
      return null;
    }

    return quoted ? `“${title}.”` : `${title}.`;
  }

  private formatLocator(
    entry: ParsedCitation,
    targetStyle: CitationStyleSlug,
  ): string | null {
    if (entry.doi) {
      return this.formatDoi(entry.doi, targetStyle);
    }

    if (entry.url) {
      return entry.url;
    }

    return null;
  }

  private formatDoi(doi: string, targetStyle: CitationStyleSlug): string {
    const normalized = doi.replace(/^doi:\s*/i, '').trim();

    if (!normalized) {
      return doi;
    }

    if (targetStyle === 'mla' || targetStyle === 'chicago-notes-bibliography') {
      return `doi:${normalized}`;
    }

    return `https://doi.org/${normalized}`;
  }

  private formatNumericPrefix(
    targetStyle: CitationStyleSlug,
    entryIndex: number,
  ): string {
    const number = entryIndex + 1;

    if (targetStyle === 'ieee' || targetStyle === 'mdpi') {
      return `[${number}]`;
    }

    return `${number}.`;
  }

  private splitAuthorName(author: string): {
    surname: string | null;
    givenNames: string | null;
  } {
    const cleaned = this.cleanWhitespace(author);
    if (!cleaned) {
      return {
        surname: null,
        givenNames: null,
      };
    }

    if (cleaned.includes(',')) {
      const [surname, ...rest] = cleaned.split(',');
      return {
        surname: this.cleanWhitespace(surname),
        givenNames: this.cleanWhitespace(rest.join(',')),
      };
    }

    const parts = cleaned.split(/\s+/u).filter(Boolean);
    if (parts.length <= 1) {
      return {
        surname: cleaned,
        givenNames: null,
      };
    }

    return {
      surname: parts.at(-1) ?? null,
      givenNames: parts.slice(0, -1).join(' '),
    };
  }

  private normalizeGivenName(givenNames: string | null): string | null {
    const cleaned = this.cleanWhitespace(givenNames ?? '');
    return cleaned || null;
  }

  private extractInitials(givenNames: string | null): string | null {
    const cleaned = this.cleanWhitespace(givenNames ?? '');
    if (!cleaned) {
      return null;
    }

    const tokens = cleaned
      .split(/\s+/u)
      .map((token) => token.replace(/[^\p{L}\p{N}'’-]+/gu, ''))
      .filter(Boolean)
      .map((token) => {
        if (/^[A-Z]\.?$/u.test(token)) {
          return token.endsWith('.') ? token : `${token}.`;
        }

        const parts = token.split('-').filter(Boolean);
        if (parts.length > 1) {
          return parts
            .map((part) => `${part.slice(0, 1).toUpperCase()}.`)
            .join('-');
        }

        return `${token.slice(0, 1).toUpperCase()}.`;
      });

    return tokens.length ? tokens.join(' ') : null;
  }

  private isCorporateAuthor(author: string): boolean {
    return /(?:university|institute|association|society|organization|organisation|committee|group|press|center|centre|department)/i.test(
      author,
    );
  }

  private joinSegments(segments: CitationStyleConversionSegment[]): string {
    return segments
      .map((segment) => segment.text)
      .filter(Boolean)
      .join(' ')
      .replace(/\s+/g, ' ')
      .replace(/\s+([,.;:])/g, '$1')
      .trim();
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

  private calculateConfidenceScore(
    entry: ParsedCitation,
    approximate: boolean,
  ): number {
    const completenessScore = [
      entry.authors.length > 0,
      Boolean(entry.title),
      Boolean(entry.year),
      Boolean(entry.containerTitle || entry.publisher),
    ].filter(Boolean).length / 4;

    const confidence = Math.max(
      0.1,
      Math.min(
        0.99,
        entry.confidenceScore * 0.55 + completenessScore * 0.4 + (approximate ? -0.15 : 0.05),
      ),
    );

    return Number(confidence.toFixed(3));
  }

  private cleanWhitespace(value: string): string {
    return value.replace(/\s+/g, ' ').trim();
  }
}
