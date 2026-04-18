import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Header,
  Param,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { JwtAuthGuard } from '../../../common/auth/jwt-auth.guard';
import { Roles } from '../../../common/auth/roles.decorator';
import { RolesGuard } from '../../../common/auth/roles.guard';
import { AnalyticsService } from '../services/analytics.service';
import { AnalyticsReportService } from '../services/analytics-report.service';
import { ReportExporterService } from '../services/report-exporter.service';
import { runAnalyticsReportSchema } from '../schemas/analytics-report.schema';

@Controller('admin/analytics')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class AnalyticsController {
  constructor(
    private readonly analyticsService: AnalyticsService,
    private readonly analyticsReportService: AnalyticsReportService,
    private readonly exporterService: ReportExporterService,
  ) {}

  @Get('snapshot')
  async snapshot(
    @Query('start') start?: string,
    @Query('end') end?: string,
  ) {
    const window = this.parseWindow(start, end);
    return this.analyticsService.snapshot(window);
  }

  @Get('reports')
  async listReports() {
    return this.analyticsReportService.list();
  }

  @Post('reports')
  async runReport(@Body() body: unknown) {
    const parsed = runAnalyticsReportSchema.parse(body);
    return this.analyticsReportService.runReport(parsed);
  }

  @Get('reports/:id/export.csv')
  @Header('Cache-Control', 'no-store')
  async exportReport(@Param('id') _id: string, @Query('start') start?: string, @Query('end') end?: string, @Res() res?: Response) {
    // Generate a fresh CSV for the requested window rather than re-reading
    // the stored JSON — keeps the export format consistent.
    const window = this.parseWindow(start, end);
    const snapshot = await this.analyticsService.snapshot(window);
    const exported = this.exporterService.toCsv(snapshot);
    if (!res) return exported;
    res.setHeader('Content-Type', exported.mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${exported.filename}"`);
    res.send(exported.content);
    return undefined;
  }

  private parseWindow(start?: string, end?: string): { start: Date; end: Date } {
    const endDate = end ? new Date(end) : new Date();
    const startDate = start ? new Date(start) : new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000);
    if (Number.isNaN(endDate.getTime()) || Number.isNaN(startDate.getTime())) {
      throw new BadRequestException('Invalid start/end date');
    }
    if (startDate > endDate) {
      throw new BadRequestException('start must be <= end');
    }
    return { start: startDate, end: endDate };
  }
}
