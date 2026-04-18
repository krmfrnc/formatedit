import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import {
  type SupportMessage,
  type SupportTicket,
  type SupportTicketChannel,
  type SupportTicketPriority,
  type SupportTicketStatus,
} from '@prisma/client';
import { PrismaService } from '../../prisma.service';

export interface CreateSupportTicketInput {
  userId: string;
  subject: string;
  body: string;
  channel?: SupportTicketChannel;
  priority?: SupportTicketPriority;
}

export interface ReplySupportTicketInput {
  ticketId: string;
  senderUserId: string;
  senderRole: 'USER' | 'ADMIN' | 'SYSTEM';
  body: string;
  isAdmin?: boolean;
}

export interface SupportSchedule {
  /** Local-time hours, 24h. e.g. 9 = 09:00. */
  startHour: number;
  endHour: number;
  /** 0 = Sunday … 6 = Saturday */
  workdays: number[];
  timezone: string;
  autoReplyMessage: string;
}

const DEFAULT_SCHEDULE: SupportSchedule = {
  startHour: 9,
  endHour: 18,
  workdays: [1, 2, 3, 4, 5],
  timezone: 'Europe/Istanbul',
  autoReplyMessage:
    'Thanks for reaching out — our team is currently outside business hours. We will reply as soon as we are back online.',
};

/**
 * Tasks 309–315: Customer support ticket service.
 *
 * Distinct from `AnalysisTicket` (paid academic-analysis jobs). The schedule
 * (Task 313) and after-hours auto-reply (Task 314) are computed in-process
 * to avoid an extra storage round-trip; admins can override the defaults
 * by setting JSON in `system_settings` under `support.schedule` (handled
 * by the system-settings module separately).
 */
@Injectable()
export class SupportService {
  constructor(private readonly prismaService: PrismaService) {}

  async create(input: CreateSupportTicketInput): Promise<SupportTicket> {
    const ticket = await this.prismaService.supportTicket.create({
      data: {
        userId: input.userId,
        subject: input.subject,
        channel: input.channel ?? 'IN_APP',
        priority: input.priority ?? 'NORMAL',
        messages: {
          create: {
            senderUserId: input.userId,
            senderRole: 'USER',
            body: input.body,
          },
        },
      },
    });

    // Task 314: Out-of-hours auto-reply from SYSTEM.
    if (!this.isWithinBusinessHours(new Date(), DEFAULT_SCHEDULE)) {
      await this.prismaService.supportMessage.create({
        data: {
          ticketId: ticket.id,
          senderRole: 'SYSTEM',
          body: DEFAULT_SCHEDULE.autoReplyMessage,
        },
      });
    }

    return ticket;
  }

  async listForUser(userId: string): Promise<SupportTicket[]> {
    return this.prismaService.supportTicket.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async listAll(status?: SupportTicketStatus): Promise<SupportTicket[]> {
    return this.prismaService.supportTicket.findMany({
      where: status ? { status } : undefined,
      orderBy: { updatedAt: 'desc' },
    });
  }

  /**
   * Task 315: Conversation history for a single ticket. Caller supplies
   * `requesterUserId`/`requesterIsAdmin` so we can enforce ownership without
   * duplicating that logic in every controller.
   */
  async history(
    ticketId: string,
    requesterUserId: string,
    requesterIsAdmin: boolean,
  ): Promise<{ ticket: SupportTicket; messages: SupportMessage[] }> {
    const ticket = await this.prismaService.supportTicket.findUnique({ where: { id: ticketId } });
    if (!ticket) throw new NotFoundException('Support ticket not found');
    if (!requesterIsAdmin && ticket.userId !== requesterUserId) {
      throw new ForbiddenException('Not your ticket');
    }
    const messages = await this.prismaService.supportMessage.findMany({
      where: { ticketId },
      orderBy: { createdAt: 'asc' },
    });
    return { ticket, messages };
  }

  async reply(input: ReplySupportTicketInput): Promise<SupportMessage> {
    const ticket = await this.prismaService.supportTicket.findUnique({
      where: { id: input.ticketId },
    });
    if (!ticket) throw new NotFoundException('Support ticket not found');
    if (!input.isAdmin && ticket.userId !== input.senderUserId) {
      throw new ForbiddenException('Not your ticket');
    }
    const message = await this.prismaService.supportMessage.create({
      data: {
        ticketId: input.ticketId,
        senderUserId: input.senderUserId,
        senderRole: input.senderRole,
        body: input.body,
      },
    });
    await this.prismaService.supportTicket.update({
      where: { id: input.ticketId },
      data: { status: input.isAdmin ? 'AWAITING_USER' : 'OPEN' },
    });
    return message;
  }

  async close(ticketId: string, requesterUserId: string, requesterIsAdmin: boolean): Promise<SupportTicket> {
    const ticket = await this.prismaService.supportTicket.findUnique({ where: { id: ticketId } });
    if (!ticket) throw new NotFoundException('Support ticket not found');
    if (!requesterIsAdmin && ticket.userId !== requesterUserId) {
      throw new ForbiddenException('Not your ticket');
    }
    return this.prismaService.supportTicket.update({
      where: { id: ticketId },
      data: { status: 'CLOSED', closedAt: new Date() },
    });
  }

  /** Task 313 helper. Exposed for tests + the auto-reply branch. */
  isWithinBusinessHours(at: Date, schedule: SupportSchedule = DEFAULT_SCHEDULE): boolean {
    // Convert `at` to the schedule's timezone using `toLocaleString` rather
    // than pulling a tz library — sufficient for IANA names supported by
    // the host's ICU.
    try {
      const local = new Date(at.toLocaleString('en-US', { timeZone: schedule.timezone }));
      const day = local.getDay();
      const hour = local.getHours();
      return schedule.workdays.includes(day) && hour >= schedule.startHour && hour < schedule.endHour;
    } catch {
      // Bad timezone: fail open (treat as within business hours).
      return true;
    }
  }
}

export const DEFAULT_SUPPORT_SCHEDULE = DEFAULT_SCHEDULE;
