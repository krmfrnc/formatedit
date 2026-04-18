import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma.service';

/**
 * Task 286: Prometheus-compatible metrics exposition.
 *
 * A `/metrics` endpoint returning the Prometheus text exposition format
 * (version 0.0.4). Intentionally minimal — we compute a handful of gauges
 * from the live database on each scrape. Prometheus scrapes are typically
 * every 15-30s; the queries are cheap (`count` with indexed predicates).
 *
 * If richer runtime metrics (HTTP latency histograms, GC stats) are needed
 * later, wrap this service around a `prom-client` Registry — the controller
 * contract stays the same.
 */
@Injectable()
export class PrometheusService {
  constructor(private readonly prismaService: PrismaService) {}

  async renderMetrics(): Promise<string> {
    const now = Date.now();
    const twentyFourHoursAgo = new Date(now - 24 * 60 * 60 * 1000);

    const [users, paymentsSucceeded24h, paymentsFailed24h, ticketsOpen, ticketsInProgress] = await Promise.all([
      this.prismaService.user.count(),
      this.prismaService.payment.count({
        where: { status: 'SUCCEEDED', createdAt: { gte: twentyFourHoursAgo } },
      }),
      this.prismaService.payment.count({
        where: { status: 'FAILED', createdAt: { gte: twentyFourHoursAgo } },
      }),
      this.prismaService.analysisTicket.count({ where: { status: 'OPEN' } }),
      this.prismaService.analysisTicket.count({ where: { status: 'IN_PROGRESS' } }).catch(() => 0),
    ]);

    const lines: string[] = [];
    const gauge = (name: string, help: string, value: number): void => {
      lines.push(`# HELP ${name} ${help}`);
      lines.push(`# TYPE ${name} gauge`);
      lines.push(`${name} ${value}`);
    };

    gauge('formatedit_users_total', 'Total registered users.', users);
    gauge('formatedit_payments_succeeded_24h', 'Successful payments in the last 24h.', paymentsSucceeded24h);
    gauge('formatedit_payments_failed_24h', 'Failed payments in the last 24h.', paymentsFailed24h);
    gauge('formatedit_tickets_open', 'Analysis tickets currently in OPEN status.', ticketsOpen);
    gauge('formatedit_tickets_in_progress', 'Analysis tickets currently IN_PROGRESS.', ticketsInProgress);
    gauge('formatedit_metrics_generated_unix_seconds', 'Server time this metrics page was generated.', Math.floor(now / 1000));

    return `${lines.join('\n')}\n`;
  }
}
