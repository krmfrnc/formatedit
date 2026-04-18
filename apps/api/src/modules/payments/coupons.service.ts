import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { CouponValidationRecord } from '@formatedit/shared';
import type { Coupon } from '@prisma/client';
import { PrismaService } from '../../prisma.service';
import type { ValidateCouponInput } from './schemas/validate-coupon.schema';

/**
 * Task 248: Coupon code validation.
 *
 * Pure read/compute service — no mutations. Redemption counting is performed
 * later, when the underlying payment actually succeeds (webhook handler).
 */
@Injectable()
export class CouponsService {
  constructor(private readonly prismaService: PrismaService) {}

  /**
   * Task 290: Admin list of all coupons (active + inactive). Returns the raw
   * Coupon row; the admin UI renders redemption progress and status.
   */
  async listAll(): Promise<Coupon[]> {
    return this.prismaService.coupon.findMany({ orderBy: { createdAt: 'desc' } });
  }

  async validate(input: ValidateCouponInput): Promise<CouponValidationRecord> {
    const coupon = await this.prismaService.coupon.findUnique({
      where: { code: input.code },
    });

    if (!coupon) {
      throw new NotFoundException('Coupon was not found');
    }

    if (!coupon.isActive) {
      throw new BadRequestException('Coupon is not active');
    }

    const now = new Date();
    if (coupon.startsAt && coupon.startsAt > now) {
      throw new BadRequestException('Coupon is not yet active');
    }
    if (coupon.expiresAt && coupon.expiresAt < now) {
      throw new BadRequestException('Coupon has expired');
    }

    if (coupon.maxRedemptions !== null && coupon.redeemedCount >= coupon.maxRedemptions) {
      throw new BadRequestException('Coupon redemption limit has been reached');
    }

    if (coupon.currency && coupon.currency.toUpperCase() !== input.currency) {
      throw new BadRequestException(
        `Coupon is only valid for currency ${coupon.currency.toUpperCase()}`,
      );
    }

    const discountCents = this.computeDiscountCents(
      coupon.discountType,
      coupon.discountValue,
      input.amountCents,
    );
    const finalAmountCents = Math.max(0, input.amountCents - discountCents);

    return {
      code: coupon.code,
      name: coupon.name,
      description: coupon.description,
      discountType: coupon.discountType,
      discountValue: coupon.discountValue,
      currency: coupon.currency,
      amountCents: input.amountCents,
      discountCents,
      finalAmountCents,
    };
  }

  private computeDiscountCents(
    discountType: 'PERCENTAGE' | 'FIXED_AMOUNT',
    discountValue: number,
    amountCents: number,
  ): number {
    if (discountType === 'PERCENTAGE') {
      const bounded = Math.min(100, Math.max(0, discountValue));
      return Math.floor((amountCents * bounded) / 100);
    }
    return Math.min(amountCents, Math.max(0, discountValue));
  }
}
