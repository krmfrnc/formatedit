import { Injectable } from '@nestjs/common';
import type {
  CitationFormatValidationIssue,
  CitationFormatValidationResult,
} from './citation-format-validator.types';
import type {
  CitationValidationReport,
  CitationValidationReportEntry,
  CitationValidationReportEntryIssue,
  CitationValidationReportStatus,
} from './citation-validation-report.types';

@Injectable()
export class CitationValidationReportService {
  buildReport(result: CitationFormatValidationResult): CitationValidationReport {
    const issuesByEntry = new Map<number, CitationFormatValidationIssue[]>();

    for (const issue of result.issues) {
      const entryIssues = issuesByEntry.get(issue.entryIndex) ?? [];
      entryIssues.push(issue);
      issuesByEntry.set(issue.entryIndex, entryIssues);
    }

    const entries = result.summaries.map((summary) => this.buildEntryReport(summary, issuesByEntry.get(summary.entryIndex) ?? []));
    const highlightedEntryIndexes = entries
      .filter((entry) => entry.status !== 'PASS')
      .map((entry) => entry.entryIndex);
    const severityCounts = this.countSeverities(result.issues);

    return {
      style: result.style,
      family: result.family,
      status: this.resolveStatus(severityCounts.errorCount, severityCounts.warningCount),
      issueCount: result.issues.length,
      errorCount: severityCounts.errorCount,
      warningCount: severityCounts.warningCount,
      infoCount: severityCounts.infoCount,
      entryCount: result.summaries.length,
      entries,
      highlightedEntryIndexes,
      recommendations: this.buildRecommendations(result.issues),
    };
  }

  private buildEntryReport(
    summary: CitationFormatValidationResult['summaries'][number],
    issues: CitationFormatValidationIssue[],
  ): CitationValidationReportEntry {
    const entryIssues: CitationValidationReportEntryIssue[] = issues.map((issue) => ({
      code: issue.code,
      severity: issue.severity,
      message: issue.message,
      fieldPath: issue.fieldPath,
      rawExcerpt: issue.rawExcerpt,
    }));

    return {
      entryIndex: summary.entryIndex,
      status: summary.errorCount > 0 ? 'FAIL' : summary.warningCount > 0 ? 'REVIEW' : 'PASS',
      issueCount: summary.issueCount,
      errorCount: summary.errorCount,
      warningCount: summary.warningCount,
      infoCount: summary.infoCount,
      issues: entryIssues,
    };
  }

  private countSeverities(issues: CitationFormatValidationIssue[]): {
    errorCount: number;
    warningCount: number;
    infoCount: number;
  } {
    return {
      errorCount: issues.filter((issue) => issue.severity === 'ERROR').length,
      warningCount: issues.filter((issue) => issue.severity === 'WARNING').length,
      infoCount: issues.filter((issue) => issue.severity === 'INFO').length,
    };
  }

  private resolveStatus(
    errorCount: number,
    warningCount: number,
  ): CitationValidationReportStatus {
    if (errorCount > 0) {
      return 'NON_COMPLIANT';
    }

    if (warningCount > 0) {
      return 'REVIEW_REQUIRED';
    }

    return 'COMPLIANT';
  }

  private buildRecommendations(issues: CitationFormatValidationIssue[]): string[] {
    const recommendations = new Set<string>();

    for (const issue of issues) {
      if (issue.severity === 'ERROR') {
        recommendations.add(issue.message);
      }

      if (issue.severity === 'WARNING' && recommendations.size < 5) {
        recommendations.add(issue.message);
      }
    }

    return [...recommendations].slice(0, 5);
  }
}
