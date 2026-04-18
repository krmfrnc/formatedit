import { Injectable } from '@nestjs/common';
import type { AnalyticsSnapshot } from './analytics.service';

export interface ExportedReport {
  filename: string;
  mimeType: string;
  content: Buffer;
}

/**
 * Task 283: Report export for analytics snapshots.
 *
 * The scheduled/on-demand report pipeline stores a JSON `metrics` blob on
 * `analytics_reports`. This service renders that snapshot into a downloadable
 * artifact. CSV is used rather than Excel/PDF to avoid shipping a heavy
 * office-document dependency for the seed implementation; CSV opens natively
 * in Excel/Numbers and matches the operational need (ops team piping the
 * file into their own reporting tools). PDF rendering can be layered on top
 * by a subsequent task without changing the call sites.
 */
@Injectable()
export class ReportExporterService {
  toCsv(snapshot: AnalyticsSnapshot): ExportedReport {
    const lines: string[] = [];
    const push = (section: string, key: string, value: string | number | null): void => {
      lines.push([this.csv(section), this.csv(key), this.csv(value == null ? '' : String(value))].join(','));
    };
    lines.push('section,metric,value');

    push('window', 'start', snapshot.window.start.toISOString());
    push('window', 'end', snapshot.window.end.toISOString());

    push('revenue', 'grossCents', snapshot.revenue.grossCents);
    push('revenue', 'netCents', snapshot.revenue.netCents);
    push('revenue', 'refundedCents', snapshot.revenue.refundedCents);
    push('revenue', 'successfulPayments', snapshot.revenue.successfulPayments);
    push('revenue', 'failedPayments', snapshot.revenue.failedPayments);
    push('revenue', 'arpu', snapshot.revenue.arpu);
    for (const c of snapshot.revenue.byCurrency) {
      push('revenue.byCurrency', `${c.currency}.grossCents`, c.grossCents);
      push('revenue.byCurrency', `${c.currency}.count`, c.count);
    }

    push('operations', 'ticketsCreated', snapshot.operations.ticketsCreated);
    push('operations', 'ticketsClosed', snapshot.operations.ticketsClosed);
    push('operations', 'ticketsOpen', snapshot.operations.ticketsOpen);
    push('operations', 'averageCloseTimeHours', snapshot.operations.averageCloseTimeHours);
    push('operations', 'failedPaymentRate', snapshot.operations.failedPaymentRate);

    push('users', 'totalUsers', snapshot.users.totalUsers);
    push('users', 'newUsersInWindow', snapshot.users.newUsersInWindow);
    push('users', 'activeUsersInWindow', snapshot.users.activeUsersInWindow);
    push('users', 'verifiedStudents', snapshot.users.verifiedStudents);

    for (const e of snapshot.experts) {
      push('experts', `${e.expertId}.completed`, e.ticketsCompleted);
      push('experts', `${e.expertId}.rating`, e.averageRating);
    }

    const ts = snapshot.window.end.toISOString().slice(0, 10);
    return {
      filename: `analytics-report-${ts}.csv`,
      mimeType: 'text/csv; charset=utf-8',
      content: Buffer.from(lines.join('\n'), 'utf8'),
    };
  }

  private csv(value: string): string {
    if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
    return value;
  }
}
