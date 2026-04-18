import { Injectable, NotFoundException } from '@nestjs/common';
import type { Announcement, AnnouncementSeverity } from '@prisma/client';
import { PrismaService } from '../../../prisma.service';

export interface UpsertAnnouncementInput {
  title: string;
  body: string;
  severity: AnnouncementSeverity;
  isActive: boolean;
  startsAt?: Date | null;
  endsAt?: Date | null;
  audience?: string;
}

/**
 * Task 288: Site-wide announcement banner content. Listing endpoints expose
 * only the currently-active window so the frontend can render without further
 * filtering.
 */
@Injectable()
export class AnnouncementsService {
  constructor(private readonly prismaService: PrismaService) {}

  async listAll(): Promise<Announcement[]> {
    return this.prismaService.announcement.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  async listActive(now: Date = new Date()): Promise<Announcement[]> {
    return this.prismaService.announcement.findMany({
      where: {
        isActive: true,
        AND: [
          { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
          { OR: [{ endsAt: null }, { endsAt: { gte: now } }] },
        ],
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(input: UpsertAnnouncementInput, createdById: string | null): Promise<Announcement> {
    return this.prismaService.announcement.create({
      data: {
        title: input.title,
        body: input.body,
        severity: input.severity,
        isActive: input.isActive,
        startsAt: input.startsAt ?? null,
        endsAt: input.endsAt ?? null,
        audience: input.audience ?? 'ALL',
        createdById: createdById ?? undefined,
      },
    });
  }

  async update(id: string, input: UpsertAnnouncementInput): Promise<Announcement> {
    const existing = await this.prismaService.announcement.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Announcement not found');
    return this.prismaService.announcement.update({
      where: { id },
      data: {
        title: input.title,
        body: input.body,
        severity: input.severity,
        isActive: input.isActive,
        startsAt: input.startsAt ?? null,
        endsAt: input.endsAt ?? null,
        audience: input.audience ?? 'ALL',
      },
    });
  }

  async delete(id: string): Promise<void> {
    await this.prismaService.announcement.delete({ where: { id } }).catch(() => undefined);
  }
}
