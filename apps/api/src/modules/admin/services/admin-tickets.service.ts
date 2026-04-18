import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, type AnalysisTicket, type AnalysisTicketStatus } from '@prisma/client';
import { PrismaService } from '../../../prisma.service';

export interface AdminTicketListQuery {
  status?: AnalysisTicketStatus;
  expertId?: string;
  customerId?: string;
  take?: number;
  cursor?: string;
}

export interface AdminTicketListResult {
  items: AnalysisTicket[];
  nextCursor: string | null;
}

/**
 * Task 276: Admin ticket management (read + assign expert).
 *
 * Destructive operations (cancelling, refunding) go through the existing
 * analysis / payments flows; this service provides the cross-customer
 * overview, expert reassignment, and status visibility the admin UI needs.
 */
@Injectable()
export class AdminTicketsService {
  constructor(private readonly prismaService: PrismaService) {}

  async list(query: AdminTicketListQuery): Promise<AdminTicketListResult> {
    const take = Math.min(Math.max(query.take ?? 25, 1), 100);
    const where: Prisma.AnalysisTicketWhereInput = {};
    if (query.status) where.status = query.status;
    if (query.expertId) where.assignedExpertUserId = query.expertId;
    if (query.customerId) where.customerUserId = query.customerId;

    const items = await this.prismaService.analysisTicket.findMany({
      where,
      take: take + 1,
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
      orderBy: { lastActivityAt: 'desc' },
    });
    const nextCursor = items.length > take ? (items[take - 1]?.id ?? null) : null;
    return { items: items.slice(0, take), nextCursor };
  }

  async assignExpert(ticketId: string, expertUserId: string | null): Promise<AnalysisTicket> {
    const existing = await this.prismaService.analysisTicket.findUnique({ where: { id: ticketId } });
    if (!existing) throw new NotFoundException('Ticket not found');
    return this.prismaService.analysisTicket.update({
      where: { id: ticketId },
      data: {
        assignedExpertUserId: expertUserId,
        assignedAt: expertUserId ? new Date() : null,
        lastActivityAt: new Date(),
      },
    });
  }
}
