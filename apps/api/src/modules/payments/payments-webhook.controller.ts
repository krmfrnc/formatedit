import {
  BadRequestException,
  Controller,
  HttpCode,
  HttpStatus,
  Headers,
  Post,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { PaymentsWebhookService } from './payments-webhook.service';

interface RequestWithRawBody extends Request {
  rawBody?: Buffer;
}

/**
 * Task 247: Inbound webhook receivers for Stripe and PayPal.
 *
 * Both endpoints are intentionally unauthenticated (no JwtAuthGuard) — payment
 * providers cannot present a user JWT. Authenticity is established via provider
 * signature verification inside PaymentsWebhookService.
 */
@Controller('payments/webhooks')
export class PaymentsWebhookController {
  constructor(private readonly paymentsWebhookService: PaymentsWebhookService) {}

  @Post('stripe')
  @HttpCode(HttpStatus.OK)
  async handleStripeWebhook(
    @Req() request: RequestWithRawBody,
    @Headers('stripe-signature') signature: string | undefined,
  ): Promise<{ received: boolean }> {
    if (!signature) {
      throw new BadRequestException('Missing Stripe-Signature header');
    }

    const rawBody = request.rawBody;
    if (!rawBody || rawBody.length === 0) {
      throw new BadRequestException('Missing raw request body');
    }

    await this.paymentsWebhookService.handleStripeWebhook(rawBody, signature);
    return { received: true };
  }

  @Post('paypal')
  @HttpCode(HttpStatus.OK)
  async handlePayPalWebhook(
    @Req() request: RequestWithRawBody,
    @Headers() headers: Record<string, string | string[] | undefined>,
  ): Promise<{ received: boolean }> {
    const rawBody = request.rawBody;
    if (!rawBody || rawBody.length === 0) {
      throw new BadRequestException('Missing raw request body');
    }

    await this.paymentsWebhookService.handlePayPalWebhook(rawBody, headers);
    return { received: true };
  }
}
