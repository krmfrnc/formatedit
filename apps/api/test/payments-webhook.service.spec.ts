import { ConfigModule } from '@nestjs/config';
import { Test, type TestingModule } from '@nestjs/testing';
import { AffiliateService } from '../src/modules/affiliate/affiliate.service';
import { AuditEventEmitterService } from '../src/modules/audit/audit-event-emitter.service';
import { NotificationsService } from '../src/modules/notifications/notifications.service';
import { InvoicesService } from '../src/modules/payments/invoices.service';
import { PaymentsWebhookService } from '../src/modules/payments/payments-webhook.service';
import { PrismaService } from '../src/prisma.service';

const constructEventMock = jest.fn();

jest.mock('stripe', () => {
  return jest.fn().mockImplementation(() => ({
    webhooks: {
      constructEvent: constructEventMock,
    },
  }));
});

describe('PaymentsWebhookService', () => {
  let service: PaymentsWebhookService;
  let fetchMock: jest.Mock;
  let prisma: {
    paymentWebhookEvent: {
      findUnique: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
    };
    payment: {
      findUnique: jest.Mock;
      findFirst: jest.Mock;
      update: jest.Mock;
    };
    subscription: {
      findFirst: jest.Mock;
      update: jest.Mock;
    };
  };
  let invoicesService: { ensureForPayment: jest.Mock };
  let auditService: { emit: jest.Mock };

  beforeEach(async () => {
    fetchMock = jest.fn();
    global.fetch = fetchMock as typeof fetch;
    constructEventMock.mockReset();

    prisma = {
      paymentWebhookEvent: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({
          id: 'webhook_record_1',
          provider: 'STRIPE',
          providerEventId: 'evt_1',
          eventType: 'checkout.session.completed',
          status: 'RECEIVED',
        }),
        update: jest.fn().mockResolvedValue(undefined),
      },
      payment: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'payment_1',
          userId: 'user_1',
          subscriptionId: 'subscription_1',
          providerPaymentId: null,
        }),
        findFirst: jest.fn().mockResolvedValue({
          id: 'payment_2',
          userId: 'user_1',
          subscriptionId: null,
          provider: 'PAYPAL',
          checkoutSessionId: 'paypal-order-1',
          providerPaymentId: null,
        }),
        update: jest.fn().mockResolvedValue(undefined),
      },
      subscription: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'subscription_1',
          providerSubscriptionId: 'sub_test_1',
          status: 'PENDING',
          currentPeriodStart: null,
          currentPeriodEnd: null,
          cancelAtPeriodEnd: false,
          canceledAt: null,
        }),
        update: jest.fn().mockResolvedValue(undefined),
      },
    };

    invoicesService = {
      ensureForPayment: jest.fn().mockResolvedValue(undefined),
    };

    auditService = {
      emit: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          ignoreEnvFile: true,
          load: [
            () => ({
              stripeSecretKey: 'sk_test_123',
              stripeWebhookSecret: 'whsec_test_123',
              paypalClientId: 'paypal-client-id',
              paypalClientSecret: 'paypal-client-secret',
              paypalBaseUrl: 'https://api-m.sandbox.paypal.test',
              paypalWebhookId: 'paypal-webhook-id',
            }),
          ],
        }),
      ],
      providers: [
        PaymentsWebhookService,
        { provide: PrismaService, useValue: prisma },
        { provide: InvoicesService, useValue: invoicesService },
        { provide: AuditEventEmitterService, useValue: auditService },
        {
          provide: NotificationsService,
          useValue: { dispatch: jest.fn().mockResolvedValue([]) },
        },
        {
          provide: AffiliateService,
          useValue: { awardForPayment: jest.fn().mockResolvedValue(null) },
        },
      ],
    }).compile();

    service = module.get(PaymentsWebhookService);
  });

  afterEach(() => {
    jest.clearAllMocks();
    fetchMock.mockReset();
  });

  function lastCallArgument<T>(mockFn: jest.Mock, index = 0): T {
    const calls = mockFn.mock.calls as unknown[][];
    const call = calls.at(-1);
    if (!call) {
      throw new Error('Expected mock to be called at least once');
    }
    return call[index] as T;
  }

  it('processes Stripe checkout completion, marks payment succeeded, and ensures invoice', async () => {
    constructEventMock.mockReturnValue({
      id: 'evt_stripe_completed_1',
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_test_123',
          payment_intent: 'pi_test_123',
          subscription: 'sub_remote_123',
          metadata: {
            paymentId: 'payment_1',
          },
        },
      },
    });

    await service.handleStripeWebhook(Buffer.from('stripe-payload'), 'stripe-signature');

    const stripePaymentUpdate = lastCallArgument<{
      where: { id: string };
      data: { status: string; providerPaymentId: string; paidAt: Date };
    }>(prisma.payment.update);
    expect(stripePaymentUpdate.where.id).toBe('payment_1');
    expect(stripePaymentUpdate.data.status).toBe('SUCCEEDED');
    expect(stripePaymentUpdate.data.providerPaymentId).toBe('pi_test_123');
    expect(stripePaymentUpdate.data.paidAt).toBeInstanceOf(Date);
    expect(prisma.subscription.update).toHaveBeenCalledWith({
      where: { id: 'subscription_1' },
      data: {
        providerSubscriptionId: 'sub_remote_123',
        status: 'ACTIVE',
      },
    });
    expect(invoicesService.ensureForPayment).toHaveBeenCalledWith('payment_1');
    const stripeWebhookUpdate = lastCallArgument<{
      where: { id: string };
      data: {
        status: string;
        paymentId: string;
        subscriptionId: string;
        processedAt: Date;
      };
    }>(prisma.paymentWebhookEvent.update);
    expect(stripeWebhookUpdate.where.id).toBe('webhook_record_1');
    expect(stripeWebhookUpdate.data.status).toBe('PROCESSED');
    expect(stripeWebhookUpdate.data.paymentId).toBe('payment_1');
    expect(stripeWebhookUpdate.data.subscriptionId).toBe('subscription_1');
    expect(stripeWebhookUpdate.data.processedAt).toBeInstanceOf(Date);
    expect(auditService.emit).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'payments.stripe.webhook.checkout.session.completed',
      }),
    );
  });

  it('skips already processed Stripe webhook events idempotently', async () => {
    prisma.paymentWebhookEvent.findUnique.mockResolvedValueOnce({
      id: 'existing_webhook',
      status: 'PROCESSED',
    });
    constructEventMock.mockReturnValue({
      id: 'evt_stripe_duplicate_1',
      type: 'checkout.session.completed',
      data: { object: {} },
    });

    await service.handleStripeWebhook(Buffer.from('stripe-payload'), 'stripe-signature');

    expect(prisma.paymentWebhookEvent.create).not.toHaveBeenCalled();
    expect(prisma.payment.update).not.toHaveBeenCalled();
    expect(invoicesService.ensureForPayment).not.toHaveBeenCalled();
  });

  it('verifies and processes PayPal approval events', async () => {
    prisma.paymentWebhookEvent.create.mockResolvedValueOnce({
      id: 'webhook_record_paypal_1',
      provider: 'PAYPAL',
      providerEventId: 'WH-PAYPAL-1',
      eventType: 'CHECKOUT.ORDER.APPROVED',
      status: 'RECEIVED',
    });
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ access_token: 'paypal-access-token' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ verification_status: 'SUCCESS' }),
      });

    await service.handlePayPalWebhook(
      Buffer.from(
        JSON.stringify({
          id: 'WH-PAYPAL-1',
          event_type: 'CHECKOUT.ORDER.APPROVED',
          resource: {
            id: 'paypal-order-1',
            purchase_units: [{ reference_id: 'paypal-order-1' }],
          },
        }),
      ),
      {
        'paypal-transmission-id': 'transmission-1',
        'paypal-transmission-time': '2026-04-16T12:00:00Z',
        'paypal-cert-url': 'https://paypal.test/cert.pem',
        'paypal-auth-algo': 'SHA256withRSA',
        'paypal-transmission-sig': 'signature-1',
      },
    );

    const paypalPaymentUpdate = lastCallArgument<{
      where: { id: string };
      data: { status: string; providerPaymentId: string; paidAt: Date };
    }>(prisma.payment.update);
    expect(paypalPaymentUpdate.where.id).toBe('payment_2');
    expect(paypalPaymentUpdate.data.status).toBe('SUCCEEDED');
    expect(paypalPaymentUpdate.data.providerPaymentId).toBe('paypal-order-1');
    expect(paypalPaymentUpdate.data.paidAt).toBeInstanceOf(Date);

    const paypalWebhookUpdate = lastCallArgument<{
      where: { id: string };
      data: { status: string; paymentId: string; processedAt: Date };
    }>(prisma.paymentWebhookEvent.update);
    expect(paypalWebhookUpdate.where.id).toBe('webhook_record_paypal_1');
    expect(paypalWebhookUpdate.data.status).toBe('PROCESSED');
    expect(paypalWebhookUpdate.data.paymentId).toBe('payment_2');
    expect(paypalWebhookUpdate.data.processedAt).toBeInstanceOf(Date);
    expect(auditService.emit).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'payments.paypal.webhook.CHECKOUT.ORDER.APPROVED',
      }),
    );
  });
});
