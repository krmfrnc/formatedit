import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PaymentsController } from '../src/modules/payments/payments.controller';
import { PaymentsService } from '../src/modules/payments/payments.service';
import { CouponsService } from '../src/modules/payments/coupons.service';
import { InvoicesService } from '../src/modules/payments/invoices.service';
import { JwtAuthGuard } from '../src/common/auth/jwt-auth.guard';

@Injectable()
class TestJwtAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<{ user?: { id: string; role: string } }>();
    request.user = {
      id: 'user_test_1',
      role: 'USER',
    };
    return true;
  }
}

describe('PaymentsController API (Task 267)', () => {
  let app: INestApplication;

  const paymentsService = {
    createStripeCheckoutSession: jest.fn(),
    createStripeSubscriptionCheckoutSession: jest.fn(),
    createPayPalOrder: jest.fn(),
    listUserSubscriptions: jest.fn(),
  };

  const couponsService = {
    validate: jest.fn(),
  };

  const invoicesService = {
    listForUser: jest.fn(),
    ensureForPaymentForUser: jest.fn(),
    renderPdfForUser: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    couponsService.validate.mockResolvedValue({
      code: 'STUDENT20',
      name: 'Student %20',
      description: 'Student discount',
      discountType: 'PERCENTAGE',
      discountValue: 20,
      currency: 'USD',
      amountCents: 10000,
      discountCents: 2000,
      finalAmountCents: 8000,
    });

    paymentsService.listUserSubscriptions.mockResolvedValue([
      {
        id: 'subscription_1',
        userId: 'user_test_1',
        provider: 'STRIPE',
        status: 'ACTIVE',
        interval: 'MONTH',
        planCode: 'PRO_MONTHLY',
        currency: 'USD',
        priceCents: 1900,
        providerSubscriptionId: 'sub_test_123',
        currentPeriodStart: '2026-04-01T00:00:00.000Z',
        currentPeriodEnd: '2026-05-01T00:00:00.000Z',
        cancelAtPeriodEnd: false,
        canceledAt: null,
        createdAt: '2026-04-01T00:00:00.000Z',
        updatedAt: '2026-04-01T00:00:00.000Z',
      },
    ]);

    invoicesService.listForUser.mockResolvedValue([
      {
        id: 'invoice_1',
        invoiceNumber: 'INV-2026-000001',
        userId: 'user_test_1',
        paymentId: 'payment_1',
        currency: 'USD',
        subtotalCents: 10000,
        discountCents: 2000,
        totalCents: 8000,
        issuedAt: '2026-04-17T00:00:00.000Z',
        createdAt: '2026-04-17T00:00:00.000Z',
        updatedAt: '2026-04-17T00:00:00.000Z',
      },
    ]);

    invoicesService.ensureForPaymentForUser.mockResolvedValue({
      id: 'invoice_1',
      invoiceNumber: 'INV-2026-000001',
      userId: 'user_test_1',
      paymentId: 'payment_1',
      currency: 'USD',
      subtotalCents: 10000,
      discountCents: 2000,
      totalCents: 8000,
      issuedAt: '2026-04-17T00:00:00.000Z',
      createdAt: '2026-04-17T00:00:00.000Z',
      updatedAt: '2026-04-17T00:00:00.000Z',
    });

    invoicesService.renderPdfForUser.mockResolvedValue({
      filename: 'INV-2026-000001.pdf',
      pdf: Buffer.from('%PDF-1.4 test invoice', 'utf8'),
    });

    paymentsService.createStripeCheckoutSession.mockResolvedValue({
      payment: {
        id: 'payment_1',
        userId: 'user_test_1',
        analysisTicketId: 'ticket_1',
        documentId: null,
        subscriptionId: null,
        provider: 'STRIPE',
        type: 'ONE_TIME',
        status: 'PENDING',
        currency: 'USD',
        amountCents: 8000,
        providerPaymentId: 'pi_test_123',
        checkoutSessionId: 'cs_test_123',
        paidAt: null,
        failedAt: null,
        refundedAt: null,
        createdAt: '2026-04-17T00:00:00.000Z',
        updatedAt: '2026-04-17T00:00:00.000Z',
      },
      checkoutUrl: 'https://checkout.stripe.test/session/cs_test_123',
    });

    paymentsService.createStripeSubscriptionCheckoutSession.mockResolvedValue({
      subscription: {
        id: 'subscription_1',
        userId: 'user_test_1',
        provider: 'STRIPE',
        status: 'PENDING',
        interval: 'MONTH',
        planCode: 'PRO_MONTHLY',
        currency: 'USD',
        priceCents: 1900,
        providerSubscriptionId: null,
        currentPeriodStart: null,
        currentPeriodEnd: null,
        cancelAtPeriodEnd: false,
        canceledAt: null,
        createdAt: '2026-04-17T00:00:00.000Z',
        updatedAt: '2026-04-17T00:00:00.000Z',
      },
      payment: {
        id: 'payment_subscription_1',
        userId: 'user_test_1',
        analysisTicketId: null,
        documentId: null,
        subscriptionId: 'subscription_1',
        provider: 'STRIPE',
        type: 'SUBSCRIPTION',
        status: 'PENDING',
        currency: 'USD',
        amountCents: 1900,
        providerPaymentId: null,
        checkoutSessionId: 'cs_sub_test_123',
        paidAt: null,
        failedAt: null,
        refundedAt: null,
        createdAt: '2026-04-17T00:00:00.000Z',
        updatedAt: '2026-04-17T00:00:00.000Z',
      },
      checkoutUrl: 'https://checkout.stripe.test/session/cs_sub_test_123',
    });

    paymentsService.createPayPalOrder.mockResolvedValue({
      payment: {
        id: 'payment_paypal_1',
        userId: 'user_test_1',
        analysisTicketId: 'ticket_1',
        documentId: null,
        subscriptionId: null,
        provider: 'PAYPAL',
        type: 'ONE_TIME',
        status: 'PENDING',
        currency: 'USD',
        amountCents: 8000,
        providerPaymentId: null,
        checkoutSessionId: 'paypal_order_123',
        paidAt: null,
        failedAt: null,
        refundedAt: null,
        createdAt: '2026-04-17T00:00:00.000Z',
        updatedAt: '2026-04-17T00:00:00.000Z',
      },
      approveUrl: 'https://paypal.test/checkoutnow?token=paypal_order_123',
    });

    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [PaymentsController],
      providers: [
        { provide: PaymentsService, useValue: paymentsService },
        { provide: CouponsService, useValue: couponsService },
        { provide: InvoicesService, useValue: invoicesService },
        { provide: JwtAuthGuard, useClass: TestJwtAuthGuard },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  function httpServer(): Parameters<typeof request>[0] {
    return app.getHttpServer() as Parameters<typeof request>[0];
  }

  it('validates coupons via API', async () => {
    const response = await request(httpServer())
      .post('/payments/coupons/validate')
      .send({
        code: 'STUDENT20',
        amountCents: 10000,
        currency: 'USD',
      });

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({
      code: 'STUDENT20',
      finalAmountCents: 8000,
    });
  });

  it('lists current user subscriptions via API', async () => {
    const response = await request(httpServer()).get('/payments/subscriptions/me');
    const body = response.body as Array<{ id: string; planCode: string }>;

    expect(response.status).toBe(200);
    expect(body).toHaveLength(1);
    expect(body[0]).toMatchObject({
      id: 'subscription_1',
      planCode: 'PRO_MONTHLY',
    });
  });

  it('lists invoices, generates one, and downloads pdf via API', async () => {
    const listResponse = await request(httpServer()).get('/payments/invoices/me');
    const listBody = listResponse.body as Array<{ invoiceNumber: string }>;
    expect(listResponse.status).toBe(200);
    expect(listBody[0]).toMatchObject({
      invoiceNumber: 'INV-2026-000001',
    });

    const generateResponse = await request(httpServer()).post(
      '/payments/invoices/from-payment/payment_1',
    );
    expect(generateResponse.status).toBe(201);
    expect(generateResponse.body).toMatchObject({
      paymentId: 'payment_1',
    });

    const pdfResponse = await request(httpServer()).get(
      '/payments/invoices/invoice_1/pdf',
    );
    expect(pdfResponse.status).toBe(200);
    expect(pdfResponse.headers['content-type']).toContain('application/pdf');
    expect(pdfResponse.headers['content-disposition']).toContain('INV-2026-000001.pdf');
  });

  it('creates stripe and paypal checkout sessions via API', async () => {
    const stripeResponse = await request(httpServer())
      .post('/payments/stripe/checkout-session')
      .send({
        analysisTicketId: 'ticket_1',
        successUrl: 'http://localhost:3000/checkout/success',
        cancelUrl: 'http://localhost:3000/checkout/cancel',
        currency: 'USD',
        couponCode: 'STUDENT20',
      });
    const stripeBody = stripeResponse.body as { checkoutUrl: string };

    expect(stripeResponse.status).toBe(201);
    expect(stripeBody.checkoutUrl).toContain('checkout.stripe.test');

    const paypalResponse = await request(httpServer())
      .post('/payments/paypal/order')
      .send({
        analysisTicketId: 'ticket_1',
        returnUrl: 'http://localhost:3000/checkout/success',
        cancelUrl: 'http://localhost:3000/checkout/cancel',
        currency: 'USD',
        couponCode: 'STUDENT20',
      });
    const paypalBody = paypalResponse.body as { approveUrl: string };

    expect(paypalResponse.status).toBe(201);
    expect(paypalBody.approveUrl).toContain('paypal.test');
  });

  it('creates subscription checkout sessions via API', async () => {
    const response = await request(httpServer())
      .post('/payments/stripe/subscription-checkout-session')
      .send({
        planCode: 'PRO_MONTHLY',
        interval: 'MONTH',
        priceCents: 1900,
        successUrl: 'http://localhost:3000/billing/success',
        cancelUrl: 'http://localhost:3000/billing/cancel',
        currency: 'USD',
      });
    const body = response.body as {
      checkoutUrl: string;
      subscription: { id: string; planCode: string };
    };

    expect(response.status).toBe(201);
    expect(body.checkoutUrl).toContain('checkout.stripe.test');
    expect(body.subscription).toMatchObject({
      id: 'subscription_1',
      planCode: 'PRO_MONTHLY',
    });
  });
});
