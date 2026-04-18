import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Notification, User } from '@prisma/client';
import type { ChannelAdapter, ChannelDispatchResult } from './channel-adapter.interface';

/**
 * Task 256: Email via Resend (https://resend.com/docs/api-reference/emails/send-email).
 *
 * Uses `fetch` — no SDK dependency. If RESEND_API_KEY is unset, throws so the
 * worker marks the notification FAILED with a clear error.
 */
@Injectable()
export class EmailChannelAdapter implements ChannelAdapter {
  readonly name = 'EMAIL';

  constructor(private readonly configService: ConfigService) {}

  async send(notification: Notification, user: User): Promise<ChannelDispatchResult> {
    const apiKey = this.configService.get<string>('resendApiKey')?.trim();
    if (!apiKey) {
      throw new ServiceUnavailableException('Resend is not configured');
    }
    const from = this.configService.get<string>('resendFromAddress') ?? 'notifications@formatedit.local';

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: [user.email],
        subject: notification.title,
        text: notification.body,
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Resend send failed (${response.status}): ${text}`);
    }

    const payload = (await response.json()) as { id?: string };
    return { providerMessageId: payload.id ?? null };
  }
}
