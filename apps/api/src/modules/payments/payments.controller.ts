import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import type { AuthenticatedUser } from '../../common/auth/authenticated-user.interface';
import { createPayPalOrderSchema } from './schemas/create-paypal-order.schema';
import { createStripeCheckoutSessionSchema } from './schemas/create-stripe-checkout-session.schema';
import { createStripeSubscriptionCheckoutSessionSchema } from './schemas/create-stripe-subscription-checkout-session.schema';
import { validateCouponSchema } from './schemas/validate-coupon.schema';
import { CouponsService } from './coupons.service';
import { InvoicesService } from './invoices.service';
import { PaymentsService } from './payments.service';

@Controller('payments')
@UseGuards(JwtAuthGuard)
export class PaymentsController {
  constructor(
    private readonly paymentsService: PaymentsService,
    private readonly couponsService: CouponsService,
    private readonly invoicesService: InvoicesService,
  ) {}

  @Post('coupons/validate')
  validateCoupon(@Body() body: unknown) {
    return this.couponsService.validate(validateCouponSchema.parse(body));
  }

  @Get('subscriptions/me')
  listMySubscriptions(@CurrentUser() user: AuthenticatedUser) {
    return this.paymentsService.listUserSubscriptions(user.id);
  }

  @Get('invoices/me')
  listMyInvoices(@CurrentUser() user: AuthenticatedUser) {
    return this.invoicesService.listForUser(user.id);
  }

  @Post('invoices/from-payment/:paymentId')
  generateInvoice(
    @CurrentUser() user: AuthenticatedUser,
    @Param('paymentId') paymentId: string,
  ) {
    return this.invoicesService.ensureForPaymentForUser(user.id, paymentId);
  }

  @Get('invoices/:invoiceId/pdf')
  @Header('Content-Type', 'application/pdf')
  async downloadInvoicePdf(
    @CurrentUser() user: AuthenticatedUser,
    @Param('invoiceId') invoiceId: string,
    @Res({ passthrough: false }) response: Response,
  ): Promise<void> {
    const { filename, pdf } = await this.invoicesService.renderPdfForUser(user.id, invoiceId);
    response.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    response.setHeader('Content-Length', pdf.length);
    response.end(pdf);
  }

  @Post('stripe/checkout-session')
  createStripeCheckoutSession(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: unknown,
  ) {
    return this.paymentsService.createStripeCheckoutSession(
      user.id,
      createStripeCheckoutSessionSchema.parse(body),
    );
  }

  @Post('stripe/subscription-checkout-session')
  createStripeSubscriptionCheckoutSession(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: unknown,
  ) {
    return this.paymentsService.createStripeSubscriptionCheckoutSession(
      user.id,
      createStripeSubscriptionCheckoutSessionSchema.parse(body),
    );
  }

  @Post('paypal/order')
  createPayPalOrder(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: unknown,
  ) {
    return this.paymentsService.createPayPalOrder(
      user.id,
      createPayPalOrderSchema.parse(body),
    );
  }
}
