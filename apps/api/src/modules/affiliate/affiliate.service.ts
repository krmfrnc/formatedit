import { ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import {
  type Affiliate,
  type AffiliateReward,
  type AffiliateRewardStatus,
  type Referral,
} from '@prisma/client';
import { PrismaService } from '../../prisma.service';

export interface AffiliateSummary {
  affiliate: Affiliate;
  referralCount: number;
  convertedCount: number;
  earnedCents: number;
  pendingCents: number;
  paidCents: number;
}

export interface RecordReferralInput {
  code: string;
  ip?: string | null;
  landingUrl?: string | null;
}

/**
 * Tasks 316-326: Affiliate program.
 *
 * Lifecycle:
 *   1. User enrolls → `enroll(userId)` mints an `Affiliate` row with a
 *      short, URL-safe code (Task 319).
 *   2. Visitor lands with `?ref=CODE` → frontend calls `recordVisit` and
 *      stashes the returned `referralId` in a cookie (Task 320). The
 *      `ipHash` enables per-IP fraud caps (Task 325).
 *   3. Visitor signs up → `attachReferredUser(referralId, newUserId)` binds
 *      the referral to the new account.
 *   4. Referred user pays → `awardForPayment(paymentId)` credits the
 *      affiliate with `commissionPercent` of the gross (Task 322). The
 *      referred user gets a launch coupon via the existing coupons system
 *      (Task 321 — UI link only; admins seed the coupon row).
 *   5. Admin approves/marks paid → `setRewardStatus` (Task 326 reports).
 */
@Injectable()
export class AffiliateService {
  private readonly logger = new Logger(AffiliateService.name);
  /** Task 325: cap to N signups per IP per affiliate per 30-day window. */
  private readonly maxSignupsPerIp = 3;

  constructor(private readonly prismaService: PrismaService) {}

  async enroll(userId: string): Promise<Affiliate> {
    const existing = await this.prismaService.affiliate.findUnique({ where: { userId } });
    if (existing) return existing;
    const code = this.generateCode();
    return this.prismaService.affiliate.create({
      data: { userId, code },
    });
  }

  async getByCode(code: string): Promise<Affiliate | null> {
    return this.prismaService.affiliate.findUnique({ where: { code } });
  }

  async getForUser(userId: string): Promise<Affiliate | null> {
    return this.prismaService.affiliate.findUnique({ where: { userId } });
  }

  async listAll(): Promise<Affiliate[]> {
    return this.prismaService.affiliate.findMany({ orderBy: { createdAt: 'desc' } });
  }

  async recordVisit(input: RecordReferralInput): Promise<Referral | null> {
    const affiliate = await this.getByCode(input.code);
    if (!affiliate || affiliate.status !== 'ACTIVE') return null;
    const ipHash = input.ip ? this.hashIp(input.ip) : null;
    return this.prismaService.referral.create({
      data: {
        affiliateId: affiliate.id,
        ipHash,
        landingUrl: input.landingUrl ?? null,
      },
    });
  }

  /**
   * Task 320: Bind a previously-recorded referral to a freshly-signed-up
   * user. Performs the fraud check before persisting (Task 325).
   */
  async attachReferredUser(referralId: string, newUserId: string): Promise<Referral | null> {
    const referral = await this.prismaService.referral.findUnique({ where: { id: referralId } });
    if (!referral || referral.referredUserId) return null;

    if (referral.ipHash) {
      const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const recentFromIp = await this.prismaService.referral.count({
        where: {
          affiliateId: referral.affiliateId,
          ipHash: referral.ipHash,
          referredUserId: { not: null },
          createdAt: { gte: since },
        },
      });
      if (recentFromIp >= this.maxSignupsPerIp) {
        this.logger.warn(`Referral fraud cap hit for affiliate ${referral.affiliateId} ip ${referral.ipHash}`);
        return null;
      }
    }

    return this.prismaService.referral.update({
      where: { id: referralId },
      data: { referredUserId: newUserId, convertedAt: new Date() },
    });
  }

  /**
   * Task 322: Credit a commission when the referred user makes a successful
   * payment. Idempotent on (affiliateId, paymentId).
   */
  async awardForPayment(paymentId: string): Promise<AffiliateReward | null> {
    const payment = await this.prismaService.payment.findUnique({ where: { id: paymentId } });
    if (!payment || payment.status !== 'SUCCEEDED') return null;

    const referral = await this.prismaService.referral.findUnique({ where: { referredUserId: payment.userId } });
    if (!referral) return null;

    const existing = await this.prismaService.affiliateReward.findFirst({
      where: { affiliateId: referral.affiliateId, paymentId },
    });
    if (existing) return existing;

    const affiliate = await this.prismaService.affiliate.findUnique({ where: { id: referral.affiliateId } });
    if (!affiliate || affiliate.status !== 'ACTIVE') return null;

    const amountCents = Math.floor((payment.amountCents * affiliate.commissionPercent) / 100);
    return this.prismaService.affiliateReward.create({
      data: {
        affiliateId: affiliate.id,
        referralId: referral.id,
        paymentId,
        amountCents,
        currency: payment.currency,
        status: 'PENDING',
      },
    });
  }

  async setRewardStatus(rewardId: string, status: AffiliateRewardStatus): Promise<AffiliateReward> {
    const existing = await this.prismaService.affiliateReward.findUnique({ where: { id: rewardId } });
    if (!existing) throw new NotFoundException('Reward not found');
    return this.prismaService.affiliateReward.update({
      where: { id: rewardId },
      data: {
        status,
        approvedAt: status === 'APPROVED' ? new Date() : existing.approvedAt,
        paidAt: status === 'PAID' ? new Date() : existing.paidAt,
      },
    });
  }

  async setCommissionPercent(affiliateId: string, percent: number): Promise<Affiliate> {
    if (percent < 0 || percent > 100) throw new ConflictException('commissionPercent out of range');
    return this.prismaService.affiliate.update({
      where: { id: affiliateId },
      data: { commissionPercent: percent },
    });
  }

  async summary(userId: string): Promise<AffiliateSummary | null> {
    const affiliate = await this.getForUser(userId);
    if (!affiliate) return null;
    const [referralCount, convertedCount, rewards] = await Promise.all([
      this.prismaService.referral.count({ where: { affiliateId: affiliate.id } }),
      this.prismaService.referral.count({
        where: { affiliateId: affiliate.id, referredUserId: { not: null } },
      }),
      this.prismaService.affiliateReward.findMany({ where: { affiliateId: affiliate.id } }),
    ]);
    const earnedCents = rewards.reduce((sum, r) => sum + r.amountCents, 0);
    const pendingCents = rewards
      .filter((r) => r.status === 'PENDING' || r.status === 'APPROVED')
      .reduce((sum, r) => sum + r.amountCents, 0);
    const paidCents = rewards.filter((r) => r.status === 'PAID').reduce((sum, r) => sum + r.amountCents, 0);
    return { affiliate, referralCount, convertedCount, earnedCents, pendingCents, paidCents };
  }

  /** Task 326: payout report for the admin panel. */
  async payoutReport(): Promise<Array<{ affiliateId: string; pendingCents: number; paidCents: number }>> {
    const rewards = await this.prismaService.affiliateReward.findMany();
    const map = new Map<string, { pendingCents: number; paidCents: number }>();
    for (const r of rewards) {
      const entry = map.get(r.affiliateId) ?? { pendingCents: 0, paidCents: 0 };
      if (r.status === 'PAID') entry.paidCents += r.amountCents;
      else if (r.status !== 'REJECTED') entry.pendingCents += r.amountCents;
      map.set(r.affiliateId, entry);
    }
    return [...map.entries()].map(([affiliateId, v]) => ({ affiliateId, ...v }));
  }

  private generateCode(): string {
    // 6 url-safe chars from base32 alphabet — collision-resistant enough
    // for the unique constraint while staying memorable.
    const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
    const bytes = randomBytes(6);
    let code = '';
    for (let i = 0; i < 6; i += 1) code += alphabet[bytes[i] % alphabet.length];
    return code;
  }

  private hashIp(ip: string): string {
    return createHash('sha256').update(ip).digest('hex').slice(0, 32);
  }
}
