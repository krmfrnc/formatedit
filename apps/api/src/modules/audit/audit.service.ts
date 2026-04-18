import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AuditLogRecord, AuditRetentionPolicy } from '@formatedit/shared';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma.service';
import type { AuditEventPayload, AuditLogFilters } from './audit.types';

@Injectable()
export class AuditService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  async logEvent(payload: AuditEventPayload): Promise<void> {
    await this.prismaService.auditLog.create({
      data: {
        eventType: payload.eventType,
        category: payload.category,
        actorType: payload.actorType ?? 'USER',
        actorUserId: payload.actorUserId,
        actorRole: payload.actorRole,
        entityType: payload.entityType,
        entityId: payload.entityId,
        targetUserId: payload.targetUserId,
        route: payload.route,
        method: payload.method,
        statusCode: payload.statusCode,
        ipAddress: payload.ipAddress,
        userAgent: payload.userAgent,
        requestId: payload.requestId,
        metadata: payload.metadata as Prisma.InputJsonValue | undefined,
      },
    });
  }

  async listLogs(filters: AuditLogFilters): Promise<AuditLogRecord[]> {
    const logs = await this.prismaService.auditLog.findMany({
      where: {
        eventType: filters.eventType,
        category: filters.category,
        actorUserId: filters.actorUserId,
        targetUserId: filters.targetUserId,
        requestId: filters.requestId,
        createdAt:
          filters.from || filters.to
            ? {
                gte: filters.from,
                lte: filters.to,
              }
            : undefined,
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: filters.limit,
    });

    return logs.map((log) => ({
      id: log.id,
      eventType: log.eventType,
      category: log.category,
      actorType: log.actorType,
      actorUserId: log.actorUserId,
      actorRole: log.actorRole,
      entityType: log.entityType,
      entityId: log.entityId,
      targetUserId: log.targetUserId,
      route: log.route,
      method: log.method,
      statusCode: log.statusCode,
      ipAddress: log.ipAddress,
      userAgent: log.userAgent,
      requestId: log.requestId,
      metadata: (log.metadata as Record<string, unknown> | null) ?? null,
      createdAt: log.createdAt.toISOString(),
    }));
  }

  async exportLogs(filters: AuditLogFilters, format: 'csv' | 'excel') {
    const logs = await this.listLogs(filters);
    const rows = [
      [
        'id',
        'eventType',
        'category',
        'actorType',
        'actorUserId',
        'actorRole',
        'entityType',
        'entityId',
        'targetUserId',
        'route',
        'method',
        'statusCode',
        'requestId',
        'createdAt',
        'metadata',
      ],
      ...logs.map((log) => [
        log.id,
        log.eventType,
        log.category,
        log.actorType,
        log.actorUserId ?? '',
        log.actorRole ?? '',
        log.entityType ?? '',
        log.entityId ?? '',
        log.targetUserId ?? '',
        log.route ?? '',
        log.method ?? '',
        log.statusCode?.toString() ?? '',
        log.requestId ?? '',
        log.createdAt,
        JSON.stringify(log.metadata ?? {}),
      ]),
    ];
    const delimiter = format === 'excel' ? '\t' : ',';
    const body = rows
      .map((row) => row.map((value) => this.escapeDelimitedValue(value, delimiter)).join(delimiter))
      .join('\n');

    return {
      body,
      contentType:
        format === 'excel' ? 'application/vnd.ms-excel; charset=utf-8' : 'text/csv; charset=utf-8',
      extension: format === 'excel' ? 'xls' : 'csv',
    };
  }

  async getRetentionPolicy(): Promise<AuditRetentionPolicy> {
    const setting = await this.prismaService.auditRetentionSetting.upsert({
      where: { id: 'default' },
      update: {},
      create: {
        id: 'default',
        retentionDays: this.configService.get<number>('auditRetentionDays', 180),
        isEnabled: true,
      },
    });

    return {
      retentionDays: setting.retentionDays,
      isEnabled: setting.isEnabled,
    };
  }

  async updateRetentionPolicy(input: AuditRetentionPolicy): Promise<AuditRetentionPolicy> {
    const setting = await this.prismaService.auditRetentionSetting.upsert({
      where: { id: 'default' },
      update: input,
      create: {
        id: 'default',
        ...input,
      },
    });

    return {
      retentionDays: setting.retentionDays,
      isEnabled: setting.isEnabled,
    };
  }

  async purgeExpiredLogs(): Promise<{ deletedCount: number }> {
    const policy = await this.getRetentionPolicy();
    if (!policy.isEnabled) {
      return { deletedCount: 0 };
    }

    const threshold = new Date(Date.now() - policy.retentionDays * 24 * 60 * 60 * 1000);
    const result = await this.prismaService.auditLog.deleteMany({
      where: {
        createdAt: {
          lt: threshold,
        },
      },
    });

    return { deletedCount: result.count };
  }

  private escapeDelimitedValue(value: string, delimiter: string): string {
    const normalized = value.replace(/\r?\n/g, ' ');
    if (!normalized.includes(delimiter) && !normalized.includes('"')) {
      return normalized;
    }

    return `"${normalized.replace(/"/g, '""')}"`;
  }
}
