import { ConfigModule } from '@nestjs/config';
import { Test, type TestingModule } from '@nestjs/testing';
import { PaymentsService } from '../src/modules/payments/payments.service';
import { PrismaService } from '../src/prisma.service';
import { AuditEventEmitterService } from '../src/modules/audit/audit-event-emitter.service';
import { CouponsService } from '../src/modules/payments/coupons.service';
import { FraudDetectionService } from '../src/modules/payments/fraud-detection.service';

jest.mock('stripe', () => {
  return jest.fn().mockImplementation(() => ({
    checkout: {
      sessions: {
        create: jest.fn().mockResolvedValue({
          id: 'cs_test_123',
          url: 'https://checkout.stripe.test/session/cs_test_123',
          payment_intent: 'pi_test_123',
        }),
      },
    },
  }));
});

describe('PaymentsService', () => {
  let service: PaymentsService;
  let fetchMock: jest.Mock;
  let prisma: {
    analysisTicket: { findUnique: jest.Mock };
    user: { findUnique: jest.Mock };
    payment: { create: jest.Mock; update: jest.Mock };
    subscription: { create: jest.Mock; update: jest.Mock };
  };

  beforeEach(async () => {
    fetchMock = jest.fn();
    global.fetch = fetchMock as typeof fetch;

    prisma = {
      analysisTicket: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'ticket_1',
          ticketNumber: 'AN-1001',
          customerUserId: 'user_1',
          title: 'Regression analysis request',
          quotePriceCents: 12500,
          quotedAt: new Date('2026-04-16T10:00:00.000Z'),
          status: 'QUOTED',
        }),
      },
      user: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'user_1',
          email: 'user@example.com',
        }),
      },
      payment: {
        create: jest.fn().mockImplementation(
          ({
            data,
          }: {
            data: {
              userId: string;
              analysisTicketId?: string;
              subscriptionId?: string;
              provider: 'STRIPE' | 'PAYPAL';
              type: 'ONE_TIME' | 'SUBSCRIPTION';
              status: 'PENDING';
              currency: string;
              amountCents: number;
              providerMetadata?: Record<string, unknown>;
            };
          }) =>
            Promise.resolve({
              id:
                data.provider === 'PAYPAL'
                  ? 'payment_paypal_1'
                  : data.type === 'SUBSCRIPTION'
                    ? 'payment_subscription_1'
                    : 'payment_1',
              userId: data.userId,
              analysisTicketId: data.analysisTicketId ?? null,
              documentId: null,
              subscriptionId: data.subscriptionId ?? null,
              provider: data.provider,
              type: data.type,
              status: data.status,
              currency: data.currency,
              amountCents: data.amountCents,
              providerPaymentId: null,
              checkoutSessionId: null,
              providerMetadata: data.providerMetadata ?? null,
              paidAt: null,
              failedAt: null,
              refundedAt: null,
              createdAt: new Date('2026-04-16T10:00:00.000Z'),
              updatedAt: new Date('2026-04-16T10:00:00.000Z'),
            }),
        ),
        update: jest.fn().mockImplementation(
          ({
            where,
            data,
          }: {
            where: { id: string };
            data: {
              checkoutSessionId?: string;
              providerPaymentId?: string | null;
            };
          }) =>
            Promise.resolve({
              id: where.id,
              userId: 'user_1',
              analysisTicketId:
                where.id === 'payment_1' || where.id === 'payment_paypal_1' ? 'ticket_1' : null,
              documentId: null,
              subscriptionId: where.id === 'payment_subscription_1' ? 'subscription_1' : null,
              provider: where.id === 'payment_paypal_1' ? 'PAYPAL' : 'STRIPE',
              type: where.id === 'payment_subscription_1' ? 'SUBSCRIPTION' : 'ONE_TIME',
              status: 'PENDING',
              currency: 'USD',
              amountCents: where.id === 'payment_subscription_1' ? 9900 : 12500,
              providerPaymentId: data.providerPaymentId ?? null,
              checkoutSessionId: data.checkoutSessionId ?? null,
              paidAt: null,
              failedAt: null,
              refundedAt: null,
              createdAt: new Date('2026-04-16T10:00:00.000Z'),
              updatedAt: new Date('2026-04-16T10:00:01.000Z'),
            }),
        ),
      },
      subscription: {
        create: jest.fn().mockResolvedValue({
          id: 'subscription_1',
          userId: 'user_1',
          provider: 'STRIPE',
          status: 'PENDING',
          interval: 'MONTH',
          planCode: 'format-pro',
          currency: 'USD',
          priceCents: 9900,
          providerSubscriptionId: null,
          currentPeriodStart: null,
          currentPeriodEnd: null,
          cancelAtPeriodEnd: false,
          canceledAt: null,
          metadata: { source: 'stripe-billing' },
          createdAt: new Date('2026-04-16T10:00:00.000Z'),
          updatedAt: new Date('2026-04-16T10:00:00.000Z'),
        }),
        update: jest.fn().mockResolvedValue({
          id: 'subscription_1',
          userId: 'user_1',
          provider: 'STRIPE',
          status: 'PENDING',
          interval: 'MONTH',
          planCode: 'format-pro',
          currency: 'USD',
          priceCents: 9900,
          providerSubscriptionId: null,
          currentPeriodStart: null,
          currentPeriodEnd: null,
          cancelAtPeriodEnd: false,
          canceledAt: null,
          createdAt: new Date('2026-04-16T10:00:00.000Z'),
          updatedAt: new Date('2026-04-16T10:00:01.000Z'),
        }),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          ignoreEnvFile: true,
          load: [
            () => ({
              stripeSecretKey: 'sk_test_123',
              paypalClientId: 'paypal-client-id',
              paypalClientSecret: 'paypal-client-secret',
              paypalBaseUrl: 'https://api-m.sandbox.paypal.test',
            }),
          ],
        }),
      ],
      providers: [
        PaymentsService,
        { provide: PrismaService, useValue: prisma },
        {
          provide: CouponsService,
          useValue: { validate: jest.fn() },
        },
        {
          provide: FraudDetectionService,
          useValue: {
            assess: jest.fn().mockResolvedValue({ level: 'ALLOW', reasons: [] }),
          },
        },
        {
          provide: AuditEventEmitterService,
          useValue: { emit: jest.fn() },
        },
      ],
    }).compile();

    service = module.get(PaymentsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
    fetchMock.mockReset();
  });

  it('creates a Stripe checkout session for a payable analysis ticket', async () => {
    const result = await service.createStripeCheckoutSession('user_1', {
      analysisTicketId: 'ticket_1',
      successUrl: 'http://localhost:3000/payments/success',
      cancelUrl: 'http://localhost:3000/payments/cancel',
      currency: 'usd',
    });

    const createCall = prisma.payment.create.mock.calls[0] as [
      {
        data: {
          userId: string;
          analysisTicketId: string;
          amountCents: number;
          currency: string;
          provider: string;
        };
      },
    ];
    const updateCall = prisma.payment.update.mock.calls[0] as [
      {
        where: { id: string };
        data: {
          checkoutSessionId: string;
          providerPaymentId: string;
        };
      },
    ];

    const createArgs = createCall[0] as {
      data: {
        userId: string;
        analysisTicketId: string;
        amountCents: number;
        currency: string;
        provider: string;
      };
    };
    const updateArgs = updateCall[0] as {
      where: { id: string };
      data: {
        checkoutSessionId: string;
        providerPaymentId: string;
      };
    };

    expect(createArgs.data.userId).toBe('user_1');
    expect(createArgs.data.analysisTicketId).toBe('ticket_1');
    expect(createArgs.data.amountCents).toBe(12500);
    expect(createArgs.data.currency).toBe('USD');
    expect(createArgs.data.provider).toBe('STRIPE');
    expect(updateArgs.where.id).toBe('payment_1');
    expect(updateArgs.data.checkoutSessionId).toBe('cs_test_123');
    expect(updateArgs.data.providerPaymentId).toBe('pi_test_123');
    expect(result.sessionId).toBe('cs_test_123');
    expect(result.checkoutUrl).toContain('checkout.stripe.test');
    expect(result.payment.checkoutSessionId).toBe('cs_test_123');
  });

  it('creates a Stripe Billing checkout session for a subscription plan', async () => {
    const result = await service.createStripeSubscriptionCheckoutSession('user_1', {
      planCode: 'format-pro',
      interval: 'MONTH',
      priceCents: 9900,
      successUrl: 'http://localhost:3000/billing/success',
      cancelUrl: 'http://localhost:3000/billing/cancel',
      currency: 'usd',
    });

    const subscriptionCreateCall = prisma.subscription.create.mock.calls[0] as [
      {
        data: {
          userId: string;
          provider: string;
          status: string;
          interval: string;
          planCode: string;
          currency: string;
          priceCents: number;
        };
      },
    ];
    const paymentCreateCall = prisma.payment.create.mock.calls[0] as [
      {
        data: {
          userId: string;
          subscriptionId: string;
          provider: string;
          type: string;
          amountCents: number;
        };
      },
    ];

    expect(subscriptionCreateCall[0].data.userId).toBe('user_1');
    expect(subscriptionCreateCall[0].data.provider).toBe('STRIPE');
    expect(subscriptionCreateCall[0].data.status).toBe('PENDING');
    expect(subscriptionCreateCall[0].data.interval).toBe('MONTH');
    expect(subscriptionCreateCall[0].data.planCode).toBe('format-pro');
    expect(subscriptionCreateCall[0].data.currency).toBe('USD');
    expect(subscriptionCreateCall[0].data.priceCents).toBe(9900);
    expect(paymentCreateCall[0].data.subscriptionId).toBe('subscription_1');
    expect(paymentCreateCall[0].data.type).toBe('SUBSCRIPTION');
    expect(paymentCreateCall[0].data.amountCents).toBe(9900);
    expect(prisma.subscription.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'subscription_1' },
      }),
    );
    expect(result.subscription.id).toBe('subscription_1');
    expect(result.payment.subscriptionId).toBe('subscription_1');
    expect(result.sessionId).toBe('cs_test_123');
  });

  it('creates a PayPal order for a payable analysis ticket', async () => {
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            access_token: 'paypal-access-token',
          }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            id: 'paypal-order-1',
            links: [
              {
                rel: 'approve',
                href: 'https://paypal.test/checkoutnow?token=paypal-order-1',
              },
            ],
          }),
      } as Response);

    const result = await service.createPayPalOrder('user_1', {
      analysisTicketId: 'ticket_1',
      returnUrl: 'http://localhost:3000/paypal/success',
      cancelUrl: 'http://localhost:3000/paypal/cancel',
      currency: 'USD',
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const paypalPaymentCreateCall = prisma.payment.create.mock.calls[0] as [
      {
        data: {
          provider: string;
          currency: string;
          amountCents: number;
        };
      },
    ];
    expect(paypalPaymentCreateCall[0].data.provider).toBe('PAYPAL');
    expect(paypalPaymentCreateCall[0].data.currency).toBe('USD');
    expect(paypalPaymentCreateCall[0].data.amountCents).toBe(12500);
    expect(result.orderId).toBe('paypal-order-1');
    expect(result.approveUrl).toContain('paypal.test/checkoutnow');
    expect(result.payment.provider).toBe('PAYPAL');
  });
});
