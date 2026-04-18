import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Tasks 310 + 311: External support channel forwarders.
 *
 * When a user opens a ticket via WhatsApp/Telegram, the inbound webhook
 * (set up out of band) calls `SupportService.create` then this service
 * fans out an acknowledgement back to the user on the same channel. The
 * Resend/Meta/Telegram credentials are reused from the notification
 * adapters — see env keys with `whatsapp*` / `telegram*` prefixes.
 */
@Injectable()
export class SupportChannelService {
  private readonly logger = new Logger(SupportChannelService.name);

  constructor(private readonly configService: ConfigService) {}

  /** Send a single message to a WhatsApp recipient via Meta Cloud API. */
  async sendWhatsApp(phoneE164: string, body: string): Promise<{ providerMessageId: string | null }> {
    const token = this.configService.get<string>('whatsappAccessToken')?.trim();
    const phoneNumberId = this.configService.get<string>('whatsappPhoneNumberId')?.trim();
    if (!token || !phoneNumberId) {
      throw new ServiceUnavailableException('WhatsApp is not configured');
    }
    const response = await fetch(`https://graph.facebook.com/v18.0/${phoneNumberId}/messages`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: phoneE164.replace(/^\+/, ''),
        type: 'text',
        text: { body },
      }),
    });
    if (!response.ok) {
      const text = await response.text();
      this.logger.warn(`WhatsApp send failed (${response.status}): ${text}`);
      return { providerMessageId: null };
    }
    const payload = (await response.json()) as { messages?: Array<{ id?: string }> };
    return { providerMessageId: payload.messages?.[0]?.id ?? null };
  }

  /** Send a single message to a Telegram chat. */
  async sendTelegram(chatId: string, body: string): Promise<{ providerMessageId: string | null }> {
    const token = this.configService.get<string>('telegramBotToken')?.trim();
    if (!token) throw new ServiceUnavailableException('Telegram is not configured');
    const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: body }),
    });
    if (!response.ok) {
      const text = await response.text();
      this.logger.warn(`Telegram send failed (${response.status}): ${text}`);
      return { providerMessageId: null };
    }
    const payload = (await response.json()) as { result?: { message_id?: number } };
    return { providerMessageId: payload.result?.message_id?.toString() ?? null };
  }
}
