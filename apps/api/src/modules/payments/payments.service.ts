import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import StripeModule from 'stripe';
import type {
  PayPalOrderRecord,
  PaymentRecord,
  StripeCheckoutSessionRecord,
  StripeSubscriptionCheckoutSessionRecord,
  SubscriptionRecord,
} from '@formatedit/shared';
import { AuditEventEmitterService } from '../audit/audit-event-emitter.service';
import type {
  CreatePayPalOrderInput,
  CreateStripeCheckoutSessionInput,
  CreateStripeSubscriptionCheckoutSessionInput,
} from './payments.types';
import { CouponsService } from './coupons.service';
import { FraudDetectionService } from './fraud-detection.service';
import { PrismaService } from '../../prisma.service';

interface StripeCheckoutSession {
  id: string;
  url?: string | null;
  payment_intent?: string | null;
  subscription?: string | null;
}

interface StripeClientLike {
  checkout: {
    sessions: {
      create(input: Record<string, unknown>): Promise<StripeCheckoutSession>;
    };
  };
}

interface PayPalAccessTokenResponse {
  access_token: string;
}

interface PayPalOrderResponse {
  id: string;
  links?: Array<{
    href: string;
    rel: string;
  }>;
}

@Injectable()
export class PaymentsService {
  private stripeClient: StripeClientLike | null = null;

  constructor(
    private readonly prismaService: PrismaService,
    private readonly configService: ConfigService,
    private readonly auditEventEmitter: AuditEventEmitterService,
    private readonly couponsService: CouponsService,
    private readonly fraudDetectionService: FraudDetectionService,
  ) {}

  /**
   * Task 269: Runs fraud assessment and either blocks the request, records a
   * REVIEW-level flag on the payment, or allows the flow to continue.
   */
  private async applyFraudAssessment(
    paymentId: string,
    input: { userId: string; amountCents: number; currency: string; countryCode?: string | null },
  ): Promise<void> {
    const assessment = await this.fraudDetectionService.assess(input);
    if (assessment.level === 'ALLOW' && assessment.reasons.length === 0) {
      return;
    }
    await this.prismaService.payment.update({
      where: { id: paymentId },
      data: {
        fraudLevel: assessment.level,
        fraudReasons: assessment.reasons as unknown as object,
      },
    });
    if (assessment.level === 'REVIEW') {
      this.auditEventEmitter.emit({
        eventType: 'payments.fraud.review',
        category: 'payments',
        actorType: 'SYSTEM',
        entityType: 'payment',
        entityId: paymentId,
        metadata: { reasons: assessment.reasons },
      });
    }
    if (assessment.level === 'BLOCK') {
      await this.prismaService.payment.update({
        where: { id: paymentId },
        data: { status: 'FAILED', failedAt: new Date() },
      });
      this.auditEventEmitter.emit({
        eventType: 'payments.fraud.blocked',
        category: 'payments',
        actorType: 'SYSTEM',
        entityType: 'payment',
        entityId: paymentId,
        metadata: { reasons: assessment.reasons },
      });
      throw new ForbiddenException('This transaction has been blocked for review');
    }
  }

  async createStripeCheckoutSession(
    userId: string,
    input: CreateStripeCheckoutSessionInput,
  ): Promise<StripeCheckoutSessionRecord> {
    const ticket = await this.prismaService.analysisTicket.findUnique({
      where: { id: input.analysisTicketId },
    });

    if (!ticket || ticket.customerUserId !== userId) {
      throw new NotFoundException('Analysis ticket was not found');
    }

    if (!ticket.quotePriceCents || ticket.quotePriceCents <= 0) {
      throw new BadRequestException('Analysis ticket does not have a payable quote yet');
    }

    if (ticket.status === 'CANCELLED' || ticket.status === 'CLOSED') {
      throw new BadRequestException('This ticket can no longer be paid');
    }

    const customer = await this.prismaService.user.findUnique({
      where: { id: userId },
    });

    if (!customer) {
      throw new NotFoundException('User was not found');
    }

    const currency = (input.currency ?? 'usd').toUpperCase();

    const couponApplication = input.couponCode
      ? await this.couponsService.validate({
          code: input.couponCode,
          amountCents: ticket.quotePriceCents,
          currency,
        })
      : null;

    const finalAmountCents = couponApplication?.finalAmountCents ?? ticket.quotePriceCents;

    const payment = await this.prismaService.payment.create({
      data: {
        userId,
        analysisTicketId: ticket.id,
        provider: 'STRIPE',
        type: 'ONE_TIME',
        status: 'PENDING',
        currency,
        amountCents: finalAmountCents,
        providerMetadata: {
          source: 'analysis-ticket',
          ticketNumber: ticket.ticketNumber,
          quotedAt: ticket.quotedAt?.toISOString() ?? null,
          originalAmountCents: ticket.quotePriceCents,
          couponCode: couponApplication?.code ?? null,
          couponDiscountCents: couponApplication?.discountCents ?? 0,
        },
      },
    });

    await this.applyFraudAssessment(payment.id, {
      userId,
      amountCents: finalAmountCents,
      currency,
      countryCode: customer.country,
    });

    const session = await this.getStripeClient().checkout.sessions.create({
      mode: 'payment',
      success_url: input.successUrl,
      cancel_url: input.cancelUrl,
      customer_email: customer.email,
      metadata: {
        paymentId: payment.id,
        analysisTicketId: ticket.id,
        ticketNumber: ticket.ticketNumber,
        userId,
        ...(couponApplication ? { couponCode: couponApplication.code } : {}),
      },
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: currency.toLowerCase(),
            unit_amount: finalAmountCents,
            product_data: {
              name: `Analysis Ticket ${ticket.ticketNumber}`,
              description: ticket.title,
            },
          },
        },
      ],
    });

    const updatedPayment = await this.prismaService.payment.update({
      where: { id: payment.id },
      data: {
        checkoutSessionId: session.id,
        providerPaymentId:
          typeof session.payment_intent === 'string' ? session.payment_intent : null,
        providerMetadata: {
          ...(payment.providerMetadata as Record<string, unknown> | null),
          checkoutUrl: session.url,
        },
      },
    });

    this.auditEventEmitter.emit({
      eventType: 'payments.stripe.checkout_session_created',
      category: 'payments',
      actorUserId: userId,
      entityType: 'payment',
      entityId: updatedPayment.id,
      metadata: {
        analysisTicketId: ticket.id,
        checkoutSessionId: session.id,
        amountCents: updatedPayment.amountCents,
        currency: updatedPayment.currency,
      },
    });

    return {
      payment: this.toPaymentRecord(updatedPayment),
      sessionId: session.id,
      checkoutUrl: session.url ?? '',
      publishableKeyRequired: true,
    };
  }

  async createStripeSubscriptionCheckoutSession(
    userId: string,
    input: CreateStripeSubscriptionCheckoutSessionInput,
  ): Promise<StripeSubscriptionCheckoutSessionRecord> {
    const customer = await this.prismaService.user.findUnique({
      where: { id: userId },
    });

    if (!customer) {
      throw new NotFoundException('User was not found');
    }

    const currency = (input.currency ?? 'usd').toUpperCase();

    const subscription = await this.prismaService.subscription.create({
      data: {
        userId,
        provider: 'STRIPE',
        status: 'PENDING',
        interval: input.interval,
        planCode: input.planCode,
        currency,
        priceCents: input.priceCents,
        metadata: {
          source: 'stripe-billing',
        },
      },
    });

    const payment = await this.prismaService.payment.create({
      data: {
        userId,
        subscriptionId: subscription.id,
        provider: 'STRIPE',
        type: 'SUBSCRIPTION',
        status: 'PENDING',
        currency,
        amountCents: input.priceCents,
        providerMetadata: {
          source: 'stripe-subscription',
          planCode: input.planCode,
          interval: input.interval,
        },
      },
    });

    await this.applyFraudAssessment(payment.id, {
      userId,
      amountCents: input.priceCents,
      currency,
      countryCode: customer.country,
    });

    const interval = input.interval === 'YEAR' ? 'year' : 'month';
    const session = await this.getStripeClient().checkout.sessions.create({
      mode: 'subscription',
      success_url: input.successUrl,
      cancel_url: input.cancelUrl,
      customer_email: customer.email,
      metadata: {
        subscriptionId: subscription.id,
        paymentId: payment.id,
        userId,
        planCode: input.planCode,
      },
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: currency.toLowerCase(),
            unit_amount: input.priceCents,
            recurring: {
              interval,
            },
            product_data: {
              name: `Subscription ${input.planCode}`,
              description: `${input.interval.toLowerCase()} subscription plan`,
            },
          },
        },
      ],
    });

    const updatedSubscription = await this.prismaService.subscription.update({
      where: { id: subscription.id },
      data: {
        providerSubscriptionId:
          typeof session.subscription === 'string' ? session.subscription : null,
        metadata: {
          ...(subscription.metadata as Record<string, unknown> | null),
          checkoutSessionId: session.id,
          checkoutUrl: session.url ?? null,
        },
      },
    });

    const updatedPayment = await this.prismaService.payment.update({
      where: { id: payment.id },
      data: {
        checkoutSessionId: session.id,
        providerPaymentId:
          typeof session.subscription === 'string' ? session.subscription : null,
        providerMetadata: {
          ...(payment.providerMetadata as Record<string, unknown> | null),
          checkoutUrl: session.url ?? null,
        },
      },
    });

    this.auditEventEmitter.emit({
      eventType: 'payments.stripe.subscription_checkout_session_created',
      category: 'payments',
      actorUserId: userId,
      entityType: 'subscription',
      entityId: updatedSubscription.id,
      metadata: {
        paymentId: updatedPayment.id,
        checkoutSessionId: session.id,
        planCode: updatedSubscription.planCode,
        interval: updatedSubscription.interval,
        amountCents: updatedSubscription.priceCents,
        currency: updatedSubscription.currency,
      },
    });

    return {
      subscription: this.toSubscriptionRecord(updatedSubscription),
      payment: this.toPaymentRecord(updatedPayment),
      sessionId: session.id,
      checkoutUrl: session.url ?? '',
      publishableKeyRequired: true,
    };
  }

  async listUserSubscriptions(userId: string): Promise<SubscriptionRecord[]> {
    const subscriptions = await this.prismaService.subscription.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
    return subscriptions.map((subscription) => this.toSubscriptionRecord(subscription));
  }

  async createPayPalOrder(
    userId: string,
    input: CreatePayPalOrderInput,
  ): Promise<PayPalOrderRecord> {
    const ticket = await this.prismaService.analysisTicket.findUnique({
      where: { id: input.analysisTicketId },
    });

    if (!ticket || ticket.customerUserId !== userId) {
      throw new NotFoundException('Analysis ticket was not found');
    }

    if (!ticket.quotePriceCents || ticket.quotePriceCents <= 0) {
      throw new BadRequestException('Analysis ticket does not have a payable quote yet');
    }

    if (ticket.status === 'CANCELLED' || ticket.status === 'CLOSED') {
      throw new BadRequestException('This ticket can no longer be paid');
    }

    const currency = input.currency ?? 'USD';

    const couponApplication = input.couponCode
      ? await this.couponsService.validate({
          code: input.couponCode,
          amountCents: ticket.quotePriceCents,
          currency,
        })
      : null;

    const finalAmountCents = couponApplication?.finalAmountCents ?? ticket.quotePriceCents;

    const payment = await this.prismaService.payment.create({
      data: {
        userId,
        analysisTicketId: ticket.id,
        provider: 'PAYPAL',
        type: 'ONE_TIME',
        status: 'PENDING',
        currency,
        amountCents: finalAmountCents,
        providerMetadata: {
          source: 'analysis-ticket',
          ticketNumber: ticket.ticketNumber,
          provider: 'paypal',
          originalAmountCents: ticket.quotePriceCents,
          couponCode: couponApplication?.code ?? null,
          couponDiscountCents: couponApplication?.discountCents ?? 0,
        },
      },
    });

    const customer = await this.prismaService.user.findUnique({ where: { id: userId } });
    await this.applyFraudAssessment(payment.id, {
      userId,
      amountCents: finalAmountCents,
      currency,
      countryCode: customer?.country ?? null,
    });

    const accessToken = await this.getPayPalAccessToken();
    const order = await this.createPayPalRemoteOrder(accessToken, {
      paymentId: payment.id,
      ticketId: ticket.id,
      ticketNumber: ticket.ticketNumber,
      amountCents: finalAmountCents,
      currency,
      returnUrl: input.returnUrl,
      cancelUrl: input.cancelUrl,
      description: ticket.title,
    });

    const approveUrl =
      order.links?.find((link) => link.rel === 'approve')?.href ??
      order.links?.find((link) => link.rel === 'payer-action')?.href;

    if (!approveUrl) {
      throw new ServiceUnavailableException('PayPal order approval URL was not returned');
    }

    const updatedPayment = await this.prismaService.payment.update({
      where: { id: payment.id },
      data: {
        checkoutSessionId: order.id,
        providerPaymentId: order.id,
        providerMetadata: {
          ...(payment.providerMetadata as Record<string, unknown> | null),
          approveUrl,
        },
      },
    });

    this.auditEventEmitter.emit({
      eventType: 'payments.paypal.order_created',
      category: 'payments',
      actorUserId: userId,
      entityType: 'payment',
      entityId: updatedPayment.id,
      metadata: {
        analysisTicketId: ticket.id,
        orderId: order.id,
        amountCents: updatedPayment.amountCents,
        currency: updatedPayment.currency,
      },
    });

    return {
      payment: this.toPaymentRecord(updatedPayment),
      orderId: order.id,
      approveUrl,
    };
  }

  private getStripeClient(): StripeClientLike {
    if (this.stripeClient) {
      return this.stripeClient;
    }

    const secretKey = this.configService.get<string>('stripeSecretKey')?.trim();

    if (!secretKey) {
      throw new ServiceUnavailableException('Stripe is not configured');
    }

    const StripeConstructor = StripeModule as unknown as new (
      secretKey: string,
      options: { apiVersion: string },
    ) => StripeClientLike;

    this.stripeClient = new StripeConstructor(secretKey, {
      apiVersion: '2026-02-25.clover',
    });

    return this.stripeClient;
  }

  private async getPayPalAccessToken(): Promise<string> {
    const clientId = this.configService.get<string>('paypalClientId')?.trim();
    const clientSecret = this.configService.get<string>('paypalClientSecret')?.trim();

    if (!clientId || !clientSecret) {
      throw new ServiceUnavailableException('PayPal is not configured');
    }

    const response = await fetch(`${this.getPayPalBaseUrl()}/v1/oauth2/token`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials',
    });

    if (!response.ok) {
      throw new ServiceUnavailableException('PayPal token request failed');
    }

    const payload = (await response.json()) as PayPalAccessTokenResponse;

    if (!payload.access_token) {
      throw new ServiceUnavailableException('PayPal token response was invalid');
    }

    return payload.access_token;
  }

  private async createPayPalRemoteOrder(
    accessToken: string,
    input: {
      paymentId: string;
      ticketId: string;
      ticketNumber: string;
      amountCents: number;
      currency: string;
      returnUrl: string;
      cancelUrl: string;
      description: string;
    },
  ): Promise<PayPalOrderResponse> {
    const response = await fetch(`${this.getPayPalBaseUrl()}/v2/checkout/orders`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        intent: 'CAPTURE',
        purchase_units: [
          {
            reference_id: input.paymentId,
            description: input.description,
            custom_id: input.ticketId,
            invoice_id: input.ticketNumber,
            amount: {
              currency_code: input.currency,
              value: (input.amountCents / 100).toFixed(2),
            },
          },
        ],
        application_context: {
          return_url: input.returnUrl,
          cancel_url: input.cancelUrl,
        },
      }),
    });

    if (!response.ok) {
      throw new ServiceUnavailableException('PayPal order creation failed');
    }

    return (await response.json()) as PayPalOrderResponse;
  }

  private getPayPalBaseUrl(): string {
    return (
      this.configService.get<string>('paypalBaseUrl')?.trim() ??
      'https://api-m.sandbox.paypal.com'
    );
  }

  private toPaymentRecord(payment: {
    id: string;
    userId: string;
    analysisTicketId: string | null;
    documentId: string | null;
    subscriptionId: string | null;
    provider: 'STRIPE' | 'PAYPAL';
    type: 'ONE_TIME' | 'SUBSCRIPTION';
    status: 'PENDING' | 'REQUIRES_ACTION' | 'SUCCEEDED' | 'FAILED' | 'CANCELLED' | 'REFUNDED';
    currency: string;
    amountCents: number;
    providerPaymentId: string | null;
    checkoutSessionId: string | null;
    paidAt: Date | null;
    failedAt: Date | null;
    refundedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  }): PaymentRecord {
    return {
      id: payment.id,
      userId: payment.userId,
      analysisTicketId: payment.analysisTicketId,
      documentId: payment.documentId,
      subscriptionId: payment.subscriptionId,
      provider: payment.provider,
      type: payment.type,
      status: payment.status,
      currency: payment.currency,
      amountCents: payment.amountCents,
      providerPaymentId: payment.providerPaymentId,
      checkoutSessionId: payment.checkoutSessionId,
      paidAt: payment.paidAt?.toISOString() ?? null,
      failedAt: payment.failedAt?.toISOString() ?? null,
      refundedAt: payment.refundedAt?.toISOString() ?? null,
      createdAt: payment.createdAt.toISOString(),
      updatedAt: payment.updatedAt.toISOString(),
    };
  }

  private toSubscriptionRecord(subscription: {
    id: string;
    userId: string;
    provider: 'STRIPE' | 'PAYPAL';
    status: 'PENDING' | 'TRIALING' | 'ACTIVE' | 'PAST_DUE' | 'CANCELLED' | 'EXPIRED';
    interval: 'MONTH' | 'YEAR';
    planCode: string;
    currency: string;
    priceCents: number;
    providerSubscriptionId: string | null;
    currentPeriodStart: Date | null;
    currentPeriodEnd: Date | null;
    cancelAtPeriodEnd: boolean;
    canceledAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  }): SubscriptionRecord {
    return {
      id: subscription.id,
      userId: subscription.userId,
      provider: subscription.provider,
      status: subscription.status,
      interval: subscription.interval,
      planCode: subscription.planCode,
      currency: subscription.currency,
      priceCents: subscription.priceCents,
      providerSubscriptionId: subscription.providerSubscriptionId,
      currentPeriodStart: subscription.currentPeriodStart?.toISOString() ?? null,
      currentPeriodEnd: subscription.currentPeriodEnd?.toISOString() ?? null,
      cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
      canceledAt: subscription.canceledAt?.toISOString() ?? null,
      createdAt: subscription.createdAt.toISOString(),
      updatedAt: subscription.updatedAt.toISOString(),
    };
  }
}
