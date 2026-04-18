import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Notification, User } from '@prisma/client';
import type { ChannelAdapter, ChannelDispatchResult } from './channel-adapter.interface';

/**
 * Task 258: Telegram via Bot API sendMessage
 * (https://core.telegram.org/bots/api#sendmessage).
 *
 * Requires TELEGRAM_BOT_TOKEN and a recipient user with `telegramChatId`.
 */
@Injectable()
export class TelegramChannelAdapter implements ChannelAdapter {
  readonly name = 'TELEGRAM';

  constructor(private readonly configService: ConfigService) {}

  async send(notification: Notification, user: User): Promise<ChannelDispatchResult> {
    const token = this.configService.get<string>('telegramBotToken')?.trim();
    if (!token) {
      throw new ServiceUnavailableException('Telegram is not configured');
    }
    if (!user.telegramChatId) {
      throw new Error('User has not linked a Telegram chat');
    }

    const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: user.telegramChatId,
        text: notification.body,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Telegram send failed (${response.status}): ${text}`);
    }

    const payload = (await response.json()) as { result?: { message_id?: number } };
    const id = payload.result?.message_id;
    return { providerMessageId: id !== undefined ? String(id) : null };
  }
}
