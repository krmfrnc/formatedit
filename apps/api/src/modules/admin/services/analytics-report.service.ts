import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma, type AnalyticsReport, type AnalyticsReportType } from '@prisma/client';
import { PrismaService } from '../../../prisma.service';
import { AnalyticsService, type AnalyticsSnapshot } from './analytics.service';
import { ReportExporterService } from './report-exporter.service';

export interface RunReportInput {
  type: AnalyticsReportType;
  start: Date;
  end: Date;
  emailTo?: string[];
}

/**
 * Task 284 + 285: Scheduled analytics report generation and email delivery.
 *
 * A lightweight cron driver is intentionally NOT wired here — the platform
 * avoids `@nestjs/schedule` to keep the dependency surface small. Instead,
 * `runReport` is the idempotent unit of work that the deployment's external
 * scheduler (Kubernetes CronJob, Cloud Scheduler, or an admin clicking
 * "Generate now") calls. Failures are persisted via AnalyticsReport.status.
 */
@Injectable()
export class AnalyticsReportService {
  private readonly logger = new Logger(AnalyticsReportService.name);

  constructor(
    private readonly prismaService: PrismaService,
    private readonly analyticsService: AnalyticsService,
    private readonly exporterService: ReportExporterService,
    private readonly configService: ConfigService,
  ) {}

  async runReport(input: RunReportInput): Promise<AnalyticsReport> {
    const pending = await this.prismaService.analyticsReport.create({
      data: {
        type: input.type,
        status: 'PENDING',
        periodStart: input.start,
        periodEnd: input.end,
        metrics: {},
      },
    });

    try {
      const snapshot = await this.analyticsService.snapshot({ start: input.start, end: input.end });
      const exported = this.exporterService.toCsv(snapshot);

      let emailedTo: string[] = [];
      if (input.emailTo?.length) {
        emailedTo = await this.emailReport(input.emailTo, exported.filename, exported.content, snapshot);
      }

      return this.prismaService.analyticsReport.update({
        where: { id: pending.id },
        data: {
          status: 'COMPLETED',
          metrics: JSON.parse(JSON.stringify(snapshot)) as Prisma.InputJsonValue,
          emailedTo: emailedTo.length > 0 ? (emailedTo as unknown as Prisma.InputJsonValue) : Prisma.JsonNull,
          errorMessage: null,
        },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`Report ${pending.id} failed: ${message}`);
      return this.prismaService.analyticsReport.update({
        where: { id: pending.id },
        data: { status: 'FAILED', errorMessage: message },
      });
    }
  }

  async list(limit = 50): Promise<AnalyticsReport[]> {
    return this.prismaService.analyticsReport.findMany({
      orderBy: { generatedAt: 'desc' },
      take: Math.min(limit, 200),
    });
  }

  /**
   * Send the CSV report as an email attachment via Resend. Returns the list
   * of addresses that were successfully accepted by Resend (all-or-nothing
   * per API call).
   */
  private async emailReport(
    recipients: string[],
    filename: string,
    content: Buffer,
    snapshot: AnalyticsSnapshot,
  ): Promise<string[]> {
    const apiKey = this.configService.get<string>('resendApiKey')?.trim();
    if (!apiKey) {
      throw new ServiceUnavailableException('Resend is not configured');
    }
    const from = this.configService.get<string>('resendFromAddress') ?? 'reports@formatedit.local';

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: recipients,
        subject: `FormatEdit analytics report — ${snapshot.window.start.toISOString().slice(0, 10)} → ${snapshot.window.end.toISOString().slice(0, 10)}`,
        text: `Attached is the analytics report for ${snapshot.window.start.toISOString()} — ${snapshot.window.end.toISOString()}.`,
        attachments: [
          {
            filename,
            content: content.toString('base64'),
          },
        ],
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Resend send failed (${response.status}): ${text}`);
    }
    return recipients;
  }
}
