import { Test, type TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { CouponsService } from '../src/modules/payments/coupons.service';
import { PrismaService } from '../src/prisma.service';

interface CouponRow {
  code: string;
  name: string;
  description: string | null;
  discountType: 'PERCENTAGE' | 'FIXED_AMOUNT';
  discountValue: number;
  currency: string | null;
  isActive: boolean;
  startsAt: Date | null;
  expiresAt: Date | null;
  maxRedemptions: number | null;
  redeemedCount: number;
}

const baseCoupon: CouponRow = {
  code: 'WELCOME10',
  name: 'Welcome 10',
  description: null,
  discountType: 'PERCENTAGE',
  discountValue: 10,
  currency: null,
  isActive: true,
  startsAt: null,
  expiresAt: null,
  maxRedemptions: null,
  redeemedCount: 0,
};

describe('CouponsService (Task 267)', () => {
  let service: CouponsService;
  let findUnique: jest.Mock;

  beforeEach(async () => {
    findUnique = jest.fn();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CouponsService,
        {
          provide: PrismaService,
          useValue: { coupon: { findUnique } },
        },
      ],
    }).compile();
    service = module.get(CouponsService);
  });

  it('applies a percentage discount and returns the final amount', async () => {
    findUnique.mockResolvedValue({ ...baseCoupon });
    const result = await service.validate({
      code: 'WELCOME10',
      amountCents: 5000,
      currency: 'USD',
    });
    expect(result.discountCents).toBe(500);
    expect(result.finalAmountCents).toBe(4500);
  });

  it('applies a fixed-amount discount, capped at the order total', async () => {
    findUnique.mockResolvedValue({
      ...baseCoupon,
      discountType: 'FIXED_AMOUNT',
      discountValue: 8000,
    });
    const result = await service.validate({
      code: 'WELCOME10',
      amountCents: 3000,
      currency: 'USD',
    });
    expect(result.discountCents).toBe(3000);
    expect(result.finalAmountCents).toBe(0);
  });

  it('rejects an expired coupon', async () => {
    findUnique.mockResolvedValue({
      ...baseCoupon,
      expiresAt: new Date('2020-01-01T00:00:00Z'),
    });
    await expect(
      service.validate({ code: 'WELCOME10', amountCents: 1000, currency: 'USD' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects when the redemption cap is reached', async () => {
    findUnique.mockResolvedValue({
      ...baseCoupon,
      maxRedemptions: 5,
      redeemedCount: 5,
    });
    await expect(
      service.validate({ code: 'WELCOME10', amountCents: 1000, currency: 'USD' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects when the coupon currency does not match', async () => {
    findUnique.mockResolvedValue({
      ...baseCoupon,
      currency: 'EUR',
      discountType: 'FIXED_AMOUNT',
      discountValue: 100,
    });
    await expect(
      service.validate({ code: 'WELCOME10', amountCents: 1000, currency: 'USD' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('throws NotFound when the code does not exist', async () => {
    findUnique.mockResolvedValue(null);
    await expect(
      service.validate({ code: 'MISSING', amountCents: 1000, currency: 'USD' }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
