/**
 * Task 263: Static template registry mapping eventType -> per-channel templates.
 *
 * Templates use pure `{{var}}` / `{{path.to.var}}` substitution — no
 * Handlebars, Mustache, or other third-party engine (see
 * NotificationTemplateEngine).
 *
 * If a channel-specific template is missing for an event, callers fall back
 * to the `generic` entry.
 */
export interface NotificationTemplateBody {
  subject?: string;
  body: string;
}

export interface NotificationTemplateSet {
  email?: NotificationTemplateBody;
  inApp?: NotificationTemplateBody;
  whatsapp?: NotificationTemplateBody;
  telegram?: NotificationTemplateBody;
  generic: NotificationTemplateBody;
}

export const NOTIFICATION_TEMPLATES: Record<string, NotificationTemplateSet> = {
  'payment.succeeded': {
    generic: {
      subject: 'Payment successful',
      body: 'Your payment of {{amount}} {{currency}} was received. Ref: {{reference}}',
    },
    email: {
      subject: 'Payment received — {{reference}}',
      body:
        'Hello {{userName}},\n\nWe received your payment of {{amount}} {{currency}} ' +
        '(reference {{reference}}).\n\nThanks for using FormatEdit.',
    },
    inApp: {
      subject: 'Payment successful',
      body: 'Payment of {{amount}} {{currency}} received.',
    },
    whatsapp: {
      body: 'FormatEdit: payment of {{amount}} {{currency}} received ({{reference}}).',
    },
    telegram: {
      body: '<b>Payment received</b>\nAmount: {{amount}} {{currency}}\nRef: {{reference}}',
    },
  },
  'payment.failed': {
    generic: {
      subject: 'Payment failed',
      body: 'Your payment of {{amount}} {{currency}} could not be processed. Reason: {{reason}}',
    },
    email: {
      subject: 'Payment failed — {{reference}}',
      body:
        'Hello {{userName}},\n\nYour payment of {{amount}} {{currency}} did not go through. ' +
        'Reason: {{reason}}.\nPlease try again from your dashboard.',
    },
  },
  'subscription.activated': {
    generic: {
      subject: 'Subscription activated',
      body: 'Your {{planCode}} subscription is now active until {{periodEnd}}.',
    },
  },
  'subscription.past_due': {
    generic: {
      subject: 'Subscription past due',
      body: 'Your {{planCode}} subscription payment failed. Please update your payment method.',
    },
  },
  'invoice.generated': {
    generic: {
      subject: 'Invoice {{invoiceNumber}} is available',
      body: 'Invoice {{invoiceNumber}} for {{amount}} {{currency}} has been issued.',
    },
  },
  'analysis.ready': {
    generic: {
      subject: 'Analysis ready',
      body: 'Your analysis ticket {{ticketNumber}} is ready for review.',
    },
  },
};

export type NotificationChannelKey = 'email' | 'inApp' | 'whatsapp' | 'telegram';

export function resolveTemplate(
  eventType: string,
  channel: NotificationChannelKey,
): NotificationTemplateBody {
  const set = NOTIFICATION_TEMPLATES[eventType];
  if (!set) {
    return {
      subject: eventType,
      body: `Event ${eventType} fired.`,
    };
  }
  return set[channel] ?? set.generic;
}
