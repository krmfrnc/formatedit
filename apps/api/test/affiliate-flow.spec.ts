import { Test, type TestingModule } from '@nestjs/testing';
import { AffiliateService } from '../src/modules/affiliate/affiliate.service';
import { PrismaService } from '../src/prisma.service';

/**
 * Task 327: Affiliate lifecycle — enroll, record visit, attach user,
 * award commission, admin approve/paid. All Prisma calls are mocked so
 * the test runs without Postgres. The intent is to lock the happy path
 * and the fraud cap, not the Prisma surface.
 */
describe('Affiliate flow (Task 327)', () => {
  let service: AffiliateService;
  let prismaMock: {
    affiliate: { findUnique: jest.Mock; create: jest.Mock; findMany: jest.Mock; update: jest.Mock };
    referral: { create: jest.Mock; findUnique: jest.Mock; update: jest.Mock; count: jest.Mock };
    payment: { findUnique: jest.Mock };
    affiliateReward: {
      findFirst: jest.Mock;
      create: jest.Mock;
      findUnique: jest.Mock;
      findMany: jest.Mock;
      update: jest.Mock;
    };
  };

  beforeEach(async () => {
    prismaMock = {
      affiliate: {
        findUnique: jest.fn(),
        create: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
      },
      referral: {
        create: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        count: jest.fn(),
      },
      payment: { findUnique: jest.fn() },
      affiliateReward: {
        findFirst: jest.fn(),
        create: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AffiliateService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    service = module.get(AffiliateService);
  });

  afterEach(() => jest.clearAllMocks());

  it('enrolls a new affiliate with a generated code', async () => {
    prismaMock.affiliate.findUnique.mockResolvedValue(null);
    prismaMock.affiliate.create.mockImplementation((args: { data: { userId: string; code: string } }) =>
      Promise.resolve({
        id: 'aff_1',
        userId: args.data.userId,
        code: args.data.code,
        status: 'ACTIVE',
        commissionPercent: 10,
      }),
    );

    const affiliate = await service.enroll('user_1');
    expect(affiliate.userId).toBe('user_1');
    expect(affiliate.code).toMatch(/^[A-Z2-9]{6}$/);
  });

  it('records a visit and binds a signup to the referral', async () => {
    prismaMock.affiliate.findUnique.mockResolvedValue({
      id: 'aff_1',
      code: 'ABC123',
      status: 'ACTIVE',
    });
    prismaMock.referral.create.mockResolvedValue({
      id: 'ref_1',
      affiliateId: 'aff_1',
      ipHash: 'hash',
    });
    const visit = await service.recordVisit({ code: 'ABC123', ip: '1.2.3.4', landingUrl: '/' });
    expect(visit?.id).toBe('ref_1');

    prismaMock.referral.findUnique.mockResolvedValue({
      id: 'ref_1',
      affiliateId: 'aff_1',
      ipHash: 'hash',
      referredUserId: null,
    });
    prismaMock.referral.count.mockResolvedValue(0);
    prismaMock.referral.update.mockResolvedValue({
      id: 'ref_1',
      affiliateId: 'aff_1',
      referredUserId: 'user_new',
    });
    const attached = await service.attachReferredUser('ref_1', 'user_new');
    expect(attached?.referredUserId).toBe('user_new');
  });

  it('rejects signup when the per-IP fraud cap is hit', async () => {
    prismaMock.referral.findUnique.mockResolvedValue({
      id: 'ref_2',
      affiliateId: 'aff_1',
      ipHash: 'hash',
      referredUserId: null,
    });
    prismaMock.referral.count.mockResolvedValue(3);
    const attached = await service.attachReferredUser('ref_2', 'user_fraud');
    expect(attached).toBeNull();
    expect(prismaMock.referral.update).not.toHaveBeenCalled();
  });

  it('awards a pending commission on a successful payment', async () => {
    prismaMock.payment.findUnique.mockResolvedValue({
      id: 'payment_1',
      userId: 'user_ref',
      status: 'SUCCEEDED',
      amountCents: 10000,
      currency: 'USD',
    });
    prismaMock.referral.findUnique.mockResolvedValue({
      id: 'ref_1',
      affiliateId: 'aff_1',
      referredUserId: 'user_ref',
    });
    prismaMock.affiliateReward.findFirst.mockResolvedValue(null);
    prismaMock.affiliate.findUnique.mockResolvedValue({
      id: 'aff_1',
      status: 'ACTIVE',
      commissionPercent: 15,
    });
    prismaMock.affiliateReward.create.mockImplementation(
      (args: { data: { amountCents: number; status: string } }) =>
        Promise.resolve({ id: 'rew_1', ...args.data }),
    );

    const reward = await service.awardForPayment('payment_1');
    expect(reward?.amountCents).toBe(1500);
    expect(reward?.status).toBe('PENDING');
  });

  it('is idempotent on repeated awards for the same payment', async () => {
    prismaMock.payment.findUnique.mockResolvedValue({
      id: 'payment_1',
      userId: 'user_ref',
      status: 'SUCCEEDED',
      amountCents: 10000,
      currency: 'USD',
    });
    prismaMock.referral.findUnique.mockResolvedValue({ id: 'ref_1', affiliateId: 'aff_1' });
    prismaMock.affiliateReward.findFirst.mockResolvedValue({
      id: 'rew_existing',
      amountCents: 1500,
      status: 'PENDING',
    });

    const reward = await service.awardForPayment('payment_1');
    expect(reward?.id).toBe('rew_existing');
    expect(prismaMock.affiliateReward.create).not.toHaveBeenCalled();
  });

  it('flips a reward to PAID with a timestamp', async () => {
    prismaMock.affiliateReward.findUnique.mockResolvedValue({
      id: 'rew_1',
      status: 'APPROVED',
      approvedAt: new Date('2026-01-01'),
      paidAt: null,
    });
    prismaMock.affiliateReward.update.mockImplementation(
      (args: { data: { status: string; paidAt: Date | null } }) =>
        Promise.resolve({ id: 'rew_1', ...args.data }),
    );

    const updated = await service.setRewardStatus('rew_1', 'PAID');
    expect(updated.status).toBe('PAID');
    expect(updated.paidAt).toBeInstanceOf(Date);
  });
});
