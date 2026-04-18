import { Body, Controller, Get, Header, Patch, Query, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { Roles } from '../../common/auth/roles.decorator';
import { RolesGuard } from '../../common/auth/roles.guard';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { AuditExportQueryDto } from './dto/audit-export-query.dto';
import { AuditLogQueryDto } from './dto/audit-log-query.dto';
import { UpdateAuditRetentionDto } from './dto/update-audit-retention.dto';
import { auditExportQuerySchema } from './schemas/audit-export-query.schema';
import { auditLogQuerySchema } from './schemas/audit-log-query.schema';
import { updateAuditRetentionSchema } from './schemas/update-audit-retention.schema';
import { AuditService } from './audit.service';

@Controller('admin/audit-logs')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN', 'SUPER_ADMIN')
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  listLogs(@Query() query: AuditLogQueryDto) {
    const filters = auditLogQuerySchema.parse(query);
    return this.auditService.listLogs({
      ...filters,
      from: filters.from ? new Date(filters.from) : undefined,
      to: filters.to ? new Date(filters.to) : undefined,
    });
  }

  @Get('export')
  async exportLogs(@Query() query: AuditExportQueryDto, @Res() response: Response) {
    const filters = auditExportQuerySchema.parse(query);
    const { format, fileName, ...listFilters } = filters;
    const exported = await this.auditService.exportLogs(
      {
        ...listFilters,
        from: listFilters.from ? new Date(listFilters.from) : undefined,
        to: listFilters.to ? new Date(listFilters.to) : undefined,
      },
      format,
    );
    const resolvedFileName = `${fileName ?? 'audit-logs'}.${exported.extension}`;

    response.setHeader('content-type', exported.contentType);
    response.setHeader('content-disposition', `attachment; filename="${resolvedFileName}"`);
    response.send(exported.body);
  }

  @Get('retention')
  getRetentionPolicy() {
    return this.auditService.getRetentionPolicy();
  }

  @Patch('retention')
  @Header('content-type', 'application/json; charset=utf-8')
  updateRetentionPolicy(@Body() body: UpdateAuditRetentionDto) {
    return this.auditService.updateRetentionPolicy(updateAuditRetentionSchema.parse(body));
  }
}
