import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma.service';

export interface MetricsWindow {
  start: Date;
  end: Date;
}

export interface RevenueMetrics {
  grossCents: number;
  netCents: number;
  refundedCents: number;
  successfulPayments: number;
  failedPayments: number;
  arpu: number;
  byCurrency: Array<{ currency: string; grossCents: number; count: number }>;
}

export interface OperationalMetrics {
  ticketsCreated: number;
  ticketsClosed: number;
  ticketsOpen: number;
  averageCloseTimeHours: number | null;
  failedPaymentRate: number;
}

export interface ExpertPerformanceMetrics {
  expertId: string;
  expertName: string | null;
  ticketsCompleted: number;
  averageRating: number | null;
}

export interface UserMetrics {
  totalUsers: number;
  newUsersInWindow: number;
  activeUsersInWindow: number;
  verifiedStudents: number;
}

export interface AnalyticsSnapshot {
  window: MetricsWindow;
  revenue: RevenueMetrics;
  operations: OperationalMetrics;
  experts: ExpertPerformanceMetrics[];
  users: UserMetrics;
}

/**
 * Tasks 278-282: Admin analytics aggregation.
 *
 * Read-only aggregator over payments, subscriptions, tickets, and users.
 * Each metric family is computed independently so the dashboard can render
 * partial data if a single aggregation fails. The snapshot is plain JSON so
 * it can be persisted to `analytics_reports.metrics` verbatim (Task 284).
 */
@Injectable()
export class AnalyticsService {
  constructor(private readonly prismaService: PrismaService) {}

  async snapshot(window: MetricsWindow): Promise<AnalyticsSnapshot> {
    const [revenue, operations, experts, users] = await Promise.all([
      this.revenue(window),
      this.operations(window),
      this.expertPerformance(window),
      this.users(window),
    ]);
    return { window, revenue, operations, experts, users };
  }

  async revenue(window: MetricsWindow): Promise<RevenueMetrics> {
    const payments = await this.prismaService.payment.findMany({
      where: { createdAt: { gte: window.start, lte: window.end } },
      select: {
        status: true,
        amountCents: true,
        currency: true,
        refundedAt: true,
      },
    });

    let grossCents = 0;
    let refundedCents = 0;
    let successfulPayments = 0;
    let failedPayments = 0;
    const currencyMap = new Map<string, { grossCents: number; count: number }>();

    for (const p of payments) {
      if (p.status === 'SUCCEEDED') {
        grossCents += p.amountCents;
        successfulPayments += 1;
        const entry = currencyMap.get(p.currency) ?? { grossCents: 0, count: 0 };
        entry.grossCents += p.amountCents;
        entry.count += 1;
        currencyMap.set(p.currency, entry);
      } else if (p.status === 'FAILED') {
        failedPayments += 1;
      }
      if (p.refundedAt) refundedCents += p.amountCents;
    }

    const distinctUserCount = await this.prismaService.payment
      .findMany({
        where: { createdAt: { gte: window.start, lte: window.end }, status: 'SUCCEEDED' },
        select: { userId: true },
        distinct: ['userId'],
      })
      .then((rows) => rows.length);

    const netCents = grossCents - refundedCents;
    const arpu = distinctUserCount > 0 ? Math.round(netCents / distinctUserCount) : 0;

    return {
      grossCents,
      netCents,
      refundedCents,
      successfulPayments,
      failedPayments,
      arpu,
      byCurrency: [...currencyMap.entries()].map(([currency, v]) => ({ currency, ...v })),
    };
  }

  async operations(window: MetricsWindow): Promise<OperationalMetrics> {
    const [ticketsCreated, ticketsClosed, ticketsOpen, closedTickets, payments] = await Promise.all([
      this.prismaService.analysisTicket.count({
        where: { createdAt: { gte: window.start, lte: window.end } },
      }),
      this.prismaService.analysisTicket.count({
        where: { closedAt: { gte: window.start, lte: window.end } },
      }),
      this.prismaService.analysisTicket.count({ where: { status: 'OPEN' } }),
      this.prismaService.analysisTicket.findMany({
        where: { closedAt: { gte: window.start, lte: window.end } },
        select: { createdAt: true, closedAt: true },
      }),
      this.prismaService.payment.findMany({
        where: { createdAt: { gte: window.start, lte: window.end } },
        select: { status: true },
      }),
    ]);

    let totalCloseHours = 0;
    let closeSamples = 0;
    for (const t of closedTickets) {
      if (t.closedAt) {
        totalCloseHours += (t.closedAt.getTime() - t.createdAt.getTime()) / 3_600_000;
        closeSamples += 1;
      }
    }
    const averageCloseTimeHours = closeSamples > 0 ? totalCloseHours / closeSamples : null;
    const failed = payments.filter((p) => p.status === 'FAILED').length;
    const failedPaymentRate = payments.length > 0 ? failed / payments.length : 0;

    return {
      ticketsCreated,
      ticketsClosed,
      ticketsOpen,
      averageCloseTimeHours,
      failedPaymentRate,
    };
  }

  async expertPerformance(window: MetricsWindow): Promise<ExpertPerformanceMetrics[]> {
    const tickets = await this.prismaService.analysisTicket.findMany({
      where: {
        closedAt: { gte: window.start, lte: window.end },
        assignedExpertUserId: { not: null },
      },
      select: {
        assignedExpertUserId: true,
        rating: true,
        assignedExpert: { select: { fullName: true } },
      },
    });

    const map = new Map<string, { name: string | null; completed: number; ratingSum: number; ratingCount: number }>();
    for (const t of tickets) {
      if (!t.assignedExpertUserId) continue;
      const entry = map.get(t.assignedExpertUserId) ?? {
        name: t.assignedExpert?.fullName ?? null,
        completed: 0,
        ratingSum: 0,
        ratingCount: 0,
      };
      entry.completed += 1;
      if (typeof t.rating === 'number') {
        entry.ratingSum += t.rating;
        entry.ratingCount += 1;
      }
      map.set(t.assignedExpertUserId, entry);
    }

    return [...map.entries()]
      .map(([expertId, v]) => ({
        expertId,
        expertName: v.name,
        ticketsCompleted: v.completed,
        averageRating: v.ratingCount > 0 ? v.ratingSum / v.ratingCount : null,
      }))
      .sort((a, b) => b.ticketsCompleted - a.ticketsCompleted);
  }

  async users(window: MetricsWindow): Promise<UserMetrics> {
    const [totalUsers, newUsers, activeUsers, verifiedStudents] = await Promise.all([
      this.prismaService.user.count(),
      this.prismaService.user.count({
        where: { createdAt: { gte: window.start, lte: window.end } },
      }),
      this.prismaService.user
        .findMany({
          where: {
            OR: [
              { analysisTickets: { some: { createdAt: { gte: window.start, lte: window.end } } } },
              { payments: { some: { createdAt: { gte: window.start, lte: window.end } } } },
            ],
          },
          select: { id: true },
        })
        .then((rows) => rows.length)
        .catch(() => 0),
      this.prismaService.studentVerification
        .findMany({
          where: { status: 'VERIFIED' },
          select: { userId: true },
          distinct: ['userId'],
        })
        .then((rows) => rows.length)
        .catch(() => 0),
    ]);

    return {
      totalUsers,
      newUsersInWindow: newUsers,
      activeUsersInWindow: activeUsers,
      verifiedStudents,
    };
  }
}
