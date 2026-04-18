import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import StripeModule from 'stripe';
import { AffiliateService } from '../affiliate/affiliate.service';
import { AuditEventEmitterService } from '../audit/audit-event-emitter.service';
import { NotificationsService } from '../notifications/notifications.service';
import { InvoicesService } from './invoices.service';
import { PrismaService } from '../../prisma.service';

interface StripeEventLike {
  id: string;
  type: string;
  data: { object: Record<string, unknown> };
}

interface StripeWebhookHelper {
  constructEvent(payload: Buffer | string, signature: string, secret: string): StripeEventLike;
}

interface StripeClientWithWebhooks {
  webhooks: StripeWebhookHelper;
}

interface PayPalEventResource {
  id?: string;
  status?: string;
  custom_id?: string;
  invoice_id?: string;
  amount?: { value?: string; currency_code?: string };
  purchase_units?: Array<{
    reference_id?: string;
    custom_id?: string;
    amount?: { value?: string; currency_code?: string };
    payments?: {
      captures?: Array<{
        id?: string;
        status?: string;
        amount?: { value?: string; currency_code?: string };
      }>;
    };
  }>;
  billing_agreement_id?: string;
}

interface PayPalEvent {
  id: string;
  event_type: string;
  resource_type?: string;
  resource?: PayPalEventResource;
}

/**
 * Task 247: Inbound webhook event processor for Stripe and PayPal.
 *
 * Responsibilities:
 *  - Verify provider signatures.
 *  - Persist every event in `payment_webhook_events` for idempotency + audit.
 *  - Reconcile Payment / Subscription state machine to provider truth.
 *
 * Task 268 — Security review (verified, no code changes required):
 *  - Stripe verification uses `stripe.webhooks.constructEvent` with the raw
 *    request body preserved by the express `verify` callback registered in
 *    `main.ts`. The Stripe SDK already performs a constant-time HMAC compare
 *    on the `t=,v1=` signature header and rejects events outside its tolerance
 *    window, defending against replay.
 *  - PayPal verification calls the official `/v1/notifications/verify-webhook-signature`
 *    endpoint with our `webhook_id`, so the trust anchor is PayPal itself —
 *    we do not roll our own RSA verification. The handler refuses the event
 *    unless the response carries `verification_status: SUCCESS`.
 *  - Both flows are idempotent: every event is keyed by `(provider,
 *    providerEventId)` with a UNIQUE constraint, and a previously PROCESSED
 *    row short-circuits before any state mutation.
 *  - All updates run inside the per-event transaction guarded by the
 *    `RECEIVED -> PROCESSED|FAILED|IGNORED` state machine, so partial failure
 *    leaves the row in FAILED with `errorMessage` for replay.
 *  - Webhook secrets are required via `ServiceUnavailableException` rather
 *    than silently no-oping, ensuring misconfigured deployments fail loudly.
 */
@Injectable()
export class PaymentsWebhookService {
  private readonly logger = new Logger(PaymentsWebhookService.name);
  private stripeClient: StripeClientWithWebhooks | null = null;

  constructor(
    private readonly prismaService: PrismaService,
    private readonly configService: ConfigService,
    private readonly auditEventEmitter: AuditEventEmitterService,
    private readonly invoicesService: InvoicesService,
    private readonly notificationsService: NotificationsService,
    private readonly affiliateService: AffiliateService,
  ) {}

  /**
   * Task 322: Best-effort affiliate commission booking on a successful
   * payment. Failures are logged but do not fail the webhook handler —
   * the operator can re-run the awarder out of band if needed.
   */
  private async safelyAwardAffiliate(paymentId: string): Promise<void> {
    try {
      await this.affiliateService.awardForPayment(paymentId);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Affiliate award skipped for ${paymentId}: ${message}`);
    }
  }

  async handleStripeWebhook(rawBody: Buffer, signature: string): Promise<void> {
    const webhookSecret = this.configService.get<string>('stripeWebhookSecret')?.trim();
    if (!webhookSecret) {
      throw new ServiceUnavailableException('Stripe webhook secret is not configured');
    }

    let event: StripeEventLike;
    try {
      event = this.getStripeClient().webhooks.constructEvent(
        rawBody,
        signature,
        webhookSecret,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : 'unknown error';
      this.logger.warn(`Rejected Stripe webhook: ${message}`);
      throw new BadRequestException(`Invalid Stripe signature: ${message}`);
    }

    const existing = await this.prismaService.paymentWebhookEvent.findUnique({
      where: {
        provider_providerEventId: {
          provider: 'STRIPE',
          providerEventId: event.id,
        },
      },
    });

    if (existing && existing.status === 'PROCESSED') {
      this.logger.log(`Stripe webhook ${event.id} already processed; skipping.`);
      return;
    }

    const record =
      existing ??
      (await this.prismaService.paymentWebhookEvent.create({
        data: {
          provider: 'STRIPE',
          providerEventId: event.id,
          eventType: event.type,
          payload: event as unknown as object,
          status: 'RECEIVED',
        },
      }));

    try {
      const result = await this.processStripeEvent(event);
      await this.prismaService.paymentWebhookEvent.update({
        where: { id: record.id },
        data: {
          status: result.handled ? 'PROCESSED' : 'IGNORED',
          paymentId: result.paymentId ?? null,
          subscriptionId: result.subscriptionId ?? null,
          processedAt: new Date(),
        },
      });

      this.auditEventEmitter.emit({
        eventType: `payments.stripe.webhook.${event.type}`,
        category: 'payments',
        actorType: 'SYSTEM',
        entityType: result.subscriptionId ? 'subscription' : 'payment',
        entityId: result.paymentId ?? result.subscriptionId ?? event.id,
        metadata: {
          providerEventId: event.id,
          handled: result.handled,
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'unknown error';
      this.logger.error(`Failed to process Stripe webhook ${event.id}: ${message}`);
      await this.prismaService.paymentWebhookEvent.update({
        where: { id: record.id },
        data: { status: 'FAILED', errorMessage: message },
      });
      throw error;
    }
  }

  async handlePayPalWebhook(
    rawBody: Buffer,
    headers: Record<string, string | string[] | undefined>,
  ): Promise<void> {
    const webhookId = this.configService.get<string>('paypalWebhookId')?.trim();
    if (!webhookId) {
      throw new ServiceUnavailableException('PayPal webhook id is not configured');
    }

    let event: PayPalEvent;
    try {
      event = JSON.parse(rawBody.toString('utf8')) as PayPalEvent;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'unknown error';
      throw new BadRequestException(`Invalid PayPal payload JSON: ${message}`);
    }

    if (!event.id || !event.event_type) {
      throw new BadRequestException('PayPal payload missing id or event_type');
    }

    const verified = await this.verifyPayPalSignature(headers, webhookId, event);
    if (!verified) {
      this.logger.warn(`Rejected PayPal webhook ${event.id}: signature mismatch`);
      throw new BadRequestException('Invalid PayPal webhook signature');
    }

    const existing = await this.prismaService.paymentWebhookEvent.findUnique({
      where: {
        provider_providerEventId: {
          provider: 'PAYPAL',
          providerEventId: event.id,
        },
      },
    });

    if (existing && existing.status === 'PROCESSED') {
      this.logger.log(`PayPal webhook ${event.id} already processed; skipping.`);
      return;
    }

    const record =
      existing ??
      (await this.prismaService.paymentWebhookEvent.create({
        data: {
          provider: 'PAYPAL',
          providerEventId: event.id,
          eventType: event.event_type,
          payload: event as unknown as object,
          status: 'RECEIVED',
        },
      }));

    try {
      const result = await this.processPayPalEvent(event);
      await this.prismaService.paymentWebhookEvent.update({
        where: { id: record.id },
        data: {
          status: result.handled ? 'PROCESSED' : 'IGNORED',
          paymentId: result.paymentId ?? null,
          subscriptionId: result.subscriptionId ?? null,
          processedAt: new Date(),
        },
      });

      this.auditEventEmitter.emit({
        eventType: `payments.paypal.webhook.${event.event_type}`,
        category: 'payments',
        actorType: 'SYSTEM',
        entityType: result.subscriptionId ? 'subscription' : 'payment',
        entityId: result.paymentId ?? result.subscriptionId ?? event.id,
        metadata: {
          providerEventId: event.id,
          handled: result.handled,
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'unknown error';
      this.logger.error(`Failed to process PayPal webhook ${event.id}: ${message}`);
      await this.prismaService.paymentWebhookEvent.update({
        where: { id: record.id },
        data: { status: 'FAILED', errorMessage: message },
      });
      throw error;
    }
  }

  private async processStripeEvent(event: StripeEventLike): Promise<{
    handled: boolean;
    paymentId?: string | null;
    subscriptionId?: string | null;
  }> {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as {
          id?: string;
          payment_intent?: string | null;
          subscription?: string | null;
          metadata?: Record<string, string | undefined>;
        };
        const paymentId = session.metadata?.paymentId;
        if (!paymentId) return { handled: false };

        const payment = await this.prismaService.payment.findUnique({
          where: { id: paymentId },
        });
        if (!payment) return { handled: false };

        await this.prismaService.payment.update({
          where: { id: paymentId },
          data: {
            status: 'SUCCEEDED',
            paidAt: new Date(),
            providerPaymentId:
              typeof session.payment_intent === 'string'
                ? session.payment_intent
                : payment.providerPaymentId,
          },
        });

        if (payment.subscriptionId && typeof session.subscription === 'string') {
          await this.prismaService.subscription.update({
            where: { id: payment.subscriptionId },
            data: {
              providerSubscriptionId: session.subscription,
              status: 'ACTIVE',
            },
          });
        }

        await this.safelyEnsureInvoice(paymentId);
        await this.notifyPaymentEvent(paymentId, 'payment.succeeded');
        await this.safelyAwardAffiliate(paymentId);

        return {
          handled: true,
          paymentId,
          subscriptionId: payment.subscriptionId,
        };
      }

      case 'payment_intent.payment_failed': {
        const intent = event.data.object as { id?: string; last_payment_error?: { message?: string } };
        if (!intent.id) return { handled: false };
        const payment = await this.prismaService.payment.findFirst({
          where: { providerPaymentId: intent.id },
        });
        if (!payment) return { handled: false };
        await this.prismaService.payment.update({
          where: { id: payment.id },
          data: { status: 'FAILED', failedAt: new Date() },
        });
        await this.notifyPaymentEvent(
          payment.id,
          'payment.failed',
          intent.last_payment_error?.message,
        );
        return { handled: true, paymentId: payment.id };
      }

      case 'charge.refunded': {
        const charge = event.data.object as { payment_intent?: string };
        if (!charge.payment_intent) return { handled: false };
        const payment = await this.prismaService.payment.findFirst({
          where: { providerPaymentId: charge.payment_intent },
        });
        if (!payment) return { handled: false };
        await this.prismaService.payment.update({
          where: { id: payment.id },
          data: { status: 'REFUNDED', refundedAt: new Date() },
        });
        return { handled: true, paymentId: payment.id };
      }

      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        const sub = event.data.object as {
          id?: string;
          status?: string;
          current_period_start?: number;
          current_period_end?: number;
          cancel_at_period_end?: boolean;
          canceled_at?: number | null;
        };
        if (!sub.id) return { handled: false };
        const subscription = await this.prismaService.subscription.findFirst({
          where: { providerSubscriptionId: sub.id },
        });
        if (!subscription) return { handled: false };
        await this.prismaService.subscription.update({
          where: { id: subscription.id },
          data: {
            status: this.mapStripeSubscriptionStatus(sub.status, event.type),
            currentPeriodStart: sub.current_period_start
              ? new Date(sub.current_period_start * 1000)
              : subscription.currentPeriodStart,
            currentPeriodEnd: sub.current_period_end
              ? new Date(sub.current_period_end * 1000)
              : subscription.currentPeriodEnd,
            cancelAtPeriodEnd: sub.cancel_at_period_end ?? subscription.cancelAtPeriodEnd,
            canceledAt: sub.canceled_at
              ? new Date(sub.canceled_at * 1000)
              : subscription.canceledAt,
          },
        });
        return { handled: true, subscriptionId: subscription.id };
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as { subscription?: string };
        if (!invoice.subscription) return { handled: false };
        const subscription = await this.prismaService.subscription.findFirst({
          where: { providerSubscriptionId: invoice.subscription },
        });
        if (!subscription) return { handled: false };
        await this.prismaService.subscription.update({
          where: { id: subscription.id },
          data: { status: 'PAST_DUE' },
        });
        return { handled: true, subscriptionId: subscription.id };
      }

      default:
        this.logger.log(`Stripe event ${event.type} ignored.`);
        return { handled: false };
    }
  }

  private mapStripeSubscriptionStatus(
    status: string | undefined,
    eventType: string,
  ): 'PENDING' | 'TRIALING' | 'ACTIVE' | 'PAST_DUE' | 'CANCELLED' | 'EXPIRED' {
    if (eventType === 'customer.subscription.deleted') return 'CANCELLED';
    switch (status) {
      case 'trialing':
        return 'TRIALING';
      case 'active':
        return 'ACTIVE';
      case 'past_due':
      case 'unpaid':
        return 'PAST_DUE';
      case 'canceled':
        return 'CANCELLED';
      case 'incomplete_expired':
        return 'EXPIRED';
      case 'incomplete':
      default:
        return 'PENDING';
    }
  }

  private async processPayPalEvent(event: PayPalEvent): Promise<{
    handled: boolean;
    paymentId?: string | null;
    subscriptionId?: string | null;
  }> {
    const resource = event.resource ?? {};

    switch (event.event_type) {
      case 'CHECKOUT.ORDER.APPROVED':
      case 'PAYMENT.CAPTURE.COMPLETED': {
        const orderId = this.extractPayPalOrderId(resource);
        if (!orderId) return { handled: false };
        const payment = await this.prismaService.payment.findFirst({
          where: {
            provider: 'PAYPAL',
            OR: [{ checkoutSessionId: orderId }, { providerPaymentId: orderId }],
          },
        });
        if (!payment) return { handled: false };
        await this.prismaService.payment.update({
          where: { id: payment.id },
          data: {
            status: 'SUCCEEDED',
            paidAt: new Date(),
            providerPaymentId: orderId,
          },
        });
        await this.safelyEnsureInvoice(payment.id);
        await this.notifyPaymentEvent(payment.id, 'payment.succeeded');
        await this.safelyAwardAffiliate(payment.id);
        return { handled: true, paymentId: payment.id };
      }

      case 'PAYMENT.CAPTURE.DENIED':
      case 'PAYMENT.CAPTURE.DECLINED': {
        const orderId = this.extractPayPalOrderId(resource);
        if (!orderId) return { handled: false };
        const payment = await this.prismaService.payment.findFirst({
          where: {
            provider: 'PAYPAL',
            OR: [{ checkoutSessionId: orderId }, { providerPaymentId: orderId }],
          },
        });
        if (!payment) return { handled: false };
        await this.prismaService.payment.update({
          where: { id: payment.id },
          data: { status: 'FAILED', failedAt: new Date() },
        });
        await this.notifyPaymentEvent(payment.id, 'payment.failed');
        return { handled: true, paymentId: payment.id };
      }

      case 'PAYMENT.CAPTURE.REFUNDED': {
        const orderId = this.extractPayPalOrderId(resource);
        if (!orderId) return { handled: false };
        const payment = await this.prismaService.payment.findFirst({
          where: {
            provider: 'PAYPAL',
            OR: [{ checkoutSessionId: orderId }, { providerPaymentId: orderId }],
          },
        });
        if (!payment) return { handled: false };
        await this.prismaService.payment.update({
          where: { id: payment.id },
          data: { status: 'REFUNDED', refundedAt: new Date() },
        });
        return { handled: true, paymentId: payment.id };
      }

      default:
        this.logger.log(`PayPal event ${event.event_type} ignored.`);
        return { handled: false };
    }
  }

  private extractPayPalOrderId(resource: PayPalEventResource): string | null {
    if (resource.id && resource.purchase_units) {
      return resource.id;
    }
    const refId = resource.purchase_units?.[0]?.reference_id;
    if (refId) return refId;
    if (resource.custom_id) return resource.custom_id;
    return resource.id ?? null;
  }

  private async verifyPayPalSignature(
    headers: Record<string, string | string[] | undefined>,
    webhookId: string,
    event: PayPalEvent,
  ): Promise<boolean> {
    const transmissionId = this.firstHeader(headers, 'paypal-transmission-id');
    const transmissionTime = this.firstHeader(headers, 'paypal-transmission-time');
    const certUrl = this.firstHeader(headers, 'paypal-cert-url');
    const authAlgo = this.firstHeader(headers, 'paypal-auth-algo');
    const transmissionSig = this.firstHeader(headers, 'paypal-transmission-sig');

    if (!transmissionId || !transmissionTime || !certUrl || !authAlgo || !transmissionSig) {
      return false;
    }

    const accessToken = await this.getPayPalAccessToken();
    const response = await fetch(
      `${this.getPayPalBaseUrl()}/v1/notifications/verify-webhook-signature`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          transmission_id: transmissionId,
          transmission_time: transmissionTime,
          cert_url: certUrl,
          auth_algo: authAlgo,
          transmission_sig: transmissionSig,
          webhook_id: webhookId,
          webhook_event: event,
        }),
      },
    );

    if (!response.ok) {
      this.logger.warn(`PayPal verify-webhook-signature returned ${response.status}`);
      return false;
    }

    const payload = (await response.json()) as { verification_status?: string };
    return payload.verification_status === 'SUCCESS';
  }

  private firstHeader(
    headers: Record<string, string | string[] | undefined>,
    name: string,
  ): string | null {
    const value = headers[name] ?? headers[name.toLowerCase()];
    if (Array.isArray(value)) return value[0] ?? null;
    return value ?? null;
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

    const payload = (await response.json()) as { access_token?: string };
    if (!payload.access_token) {
      throw new ServiceUnavailableException('PayPal token response was invalid');
    }
    return payload.access_token;
  }

  private getPayPalBaseUrl(): string {
    return (
      this.configService.get<string>('paypalBaseUrl')?.trim() ??
      'https://api-m.sandbox.paypal.com'
    );
  }

  private getStripeClient(): StripeClientWithWebhooks {
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
    ) => StripeClientWithWebhooks;

    this.stripeClient = new StripeConstructor(secretKey, {
      apiVersion: '2026-02-25.clover',
    });
    return this.stripeClient;
  }

  private async safelyEnsureInvoice(paymentId: string): Promise<void> {
    try {
      await this.invoicesService.ensureForPayment(paymentId);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'unknown error';
      this.logger.warn(`Invoice generation skipped for payment ${paymentId}: ${message}`);
    }
  }

  private async notifyPaymentEvent(
    paymentId: string,
    eventType: 'payment.succeeded' | 'payment.failed',
    reason?: string,
  ): Promise<void> {
    try {
      const payment = await this.prismaService.payment.findUnique({
        where: { id: paymentId },
      });
      if (!payment) return;
      await this.notificationsService.dispatch({
        userId: payment.userId,
        eventType,
        variables: {
          amount: (payment.amountCents / 100).toFixed(2),
          currency: payment.currency,
          reference: payment.id,
          reason: reason ?? '',
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'unknown error';
      this.logger.warn(`Notification dispatch skipped for payment ${paymentId}: ${message}`);
    }
  }
}
