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
    webhooks: { constructEvent: constructEventMock },
  }));
});

/**
 * Task 270: End-to-end glue between the payment success webhook and the
 * notifications engine. Verifies that a Stripe `checkout.session.completed`
 * event causes:
 *   - Payment marked SUCCEEDED.
 *   - InvoicesService.ensureForPayment invoked.
 *   - NotificationsService.dispatch invoked with `payment.succeeded`.
 *
 * Real Redis/DB are not required — Prisma + queue + adapter dependencies are
 * mocked. Set RUN_E2E=1 to opt in to the slower, infrastructure-backed tests
 * that live elsewhere; this spec runs in the standard unit harness.
 */
describe('Payment + Notification flow (Task 270)', () => {
  let webhook: PaymentsWebhookService;
  let notificationsDispatch: jest.Mock;
  let ensureInvoice: jest.Mock;
  let prismaPaymentUpdate: jest.Mock;

  beforeEach(async () => {
    constructEventMock.mockReset();

    prismaPaymentUpdate = jest.fn().mockResolvedValue(undefined);
    ensureInvoice = jest.fn().mockResolvedValue(undefined);
    notificationsDispatch = jest.fn().mockResolvedValue([]);

    const prisma = {
      paymentWebhookEvent: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({
          id: 'whe_1',
          provider: 'STRIPE',
          providerEventId: 'evt_1',
          eventType: 'checkout.session.completed',
          status: 'RECEIVED',
        }),
        update: jest.fn().mockResolvedValue(undefined),
      },
      payment: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'payment_e2e_1',
          userId: 'user_e2e_1',
          subscriptionId: null,
          providerPaymentId: null,
          amountCents: 9900,
          currency: 'USD',
        }),
        update: prismaPaymentUpdate,
      },
      subscription: {
        findFirst: jest.fn().mockResolvedValue(null),
        update: jest.fn().mockResolvedValue(undefined),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          ignoreEnvFile: true,
          load: [
            () => ({
              stripeSecretKey: 'sk_test_e2e',
              stripeWebhookSecret: 'whsec_test_e2e',
            }),
          ],
        }),
      ],
      providers: [
        PaymentsWebhookService,
        { provide: PrismaService, useValue: prisma },
        { provide: InvoicesService, useValue: { ensureForPayment: ensureInvoice } },
        { provide: AuditEventEmitterService, useValue: { emit: jest.fn() } },
        {
          provide: NotificationsService,
          useValue: { dispatch: notificationsDispatch },
        },
        {
          provide: AffiliateService,
          useValue: { awardForPayment: jest.fn().mockResolvedValue(null) },
        },
      ],
    }).compile();

    webhook = module.get(PaymentsWebhookService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('marks the payment succeeded, ensures the invoice, and dispatches a payment.succeeded notification', async () => {
    constructEventMock.mockReturnValue({
      id: 'evt_1',
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_test_1',
          payment_intent: 'pi_test_1',
          subscription: null,
          metadata: { paymentId: 'payment_e2e_1' },
        },
      },
    });

    await webhook.handleStripeWebhook(Buffer.from('{}'), 't=1,v1=sig');

    const calls = prismaPaymentUpdate.mock.calls as Array<
      [{ where: { id: string }; data: { status: string } }]
    >;
    const updateCall = calls.find((call) => call[0].where.id === 'payment_e2e_1');
    expect(updateCall).toBeDefined();
    if (!updateCall) throw new Error('payment update missing');
    expect(updateCall[0].data.status).toBe('SUCCEEDED');

    expect(ensureInvoice).toHaveBeenCalledWith('payment_e2e_1');
    expect(notificationsDispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user_e2e_1',
        eventType: 'payment.succeeded',
      }),
    );
  });
});
