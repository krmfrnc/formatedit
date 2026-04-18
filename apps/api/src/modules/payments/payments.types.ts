export interface CreateStripeCheckoutSessionInput {
  analysisTicketId: string;
  successUrl: string;
  cancelUrl: string;
  currency?: string;
  couponCode?: string;
}

export interface CreateStripeSubscriptionCheckoutSessionInput {
  planCode: string;
  interval: 'MONTH' | 'YEAR';
  priceCents: number;
  successUrl: string;
  cancelUrl: string;
  currency?: string;
}

export interface CreatePayPalOrderInput {
  analysisTicketId: string;
  returnUrl: string;
  cancelUrl: string;
  currency?: string;
  couponCode?: string;
}
