import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Notification, User } from '@prisma/client';
import type { ChannelAdapter, ChannelDispatchResult } from './channel-adapter.interface';

/**
 * Task 257: WhatsApp Business via the Meta Cloud API.
 *
 * POST https://graph.facebook.com/v21.0/{phone_number_id}/messages
 * Requires WHATSAPP_TOKEN, WHATSAPP_PHONE_NUMBER_ID and a recipient user
 * with `phoneNumber` populated.
 */
@Injectable()
export class WhatsAppChannelAdapter implements ChannelAdapter {
  readonly name = 'WHATSAPP';

  constructor(private readonly configService: ConfigService) {}

  async send(notification: Notification, user: User): Promise<ChannelDispatchResult> {
    const token = this.configService.get<string>('whatsappToken')?.trim();
    const phoneNumberId = this.configService.get<string>('whatsappPhoneNumberId')?.trim();
    if (!token || !phoneNumberId) {
      throw new ServiceUnavailableException('WhatsApp is not configured');
    }
    if (!user.phoneNumber) {
      throw new Error('User has no WhatsApp-capable phone number');
    }

    const response = await fetch(
      `https://graph.facebook.com/v21.0/${phoneNumberId}/messages`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: user.phoneNumber,
          type: 'text',
          text: { body: notification.body },
        }),
      },
    );

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`WhatsApp send failed (${response.status}): ${text}`);
    }

    const payload = (await response.json()) as { messages?: Array<{ id?: string }> };
    return { providerMessageId: payload.messages?.[0]?.id ?? null };
  }
}
