import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import type { AuthenticatedUser } from '../../common/auth/authenticated-user.interface';
import { NotificationPreferencesService } from './notification-preferences.service';
import { NotificationsService } from './notifications.service';
import {
  updateEventPreferenceSchema,
  updateGlobalPreferencesSchema,
} from './schemas/update-preferences.schema';

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(
    private readonly notificationsService: NotificationsService,
    private readonly preferencesService: NotificationPreferencesService,
  ) {}

  @Get()
  async list(
    @CurrentUser() user: AuthenticatedUser,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ) {
    const parsedLimit = limit ? Number.parseInt(limit, 10) : undefined;
    return this.notificationsService.listForUser(user.id, {
      cursor,
      limit: Number.isFinite(parsedLimit) ? parsedLimit : undefined,
    });
  }

  @Get('unread-count')
  async unreadCount(@CurrentUser() user: AuthenticatedUser) {
    const count = await this.notificationsService.countUnreadForUser(user.id);
    return { count };
  }

  @Post(':id/read')
  markRead(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.notificationsService.markRead(user.id, id);
  }

  @Get('preferences')
  getPreferences(@CurrentUser() user: AuthenticatedUser) {
    return this.preferencesService.getForUser(user.id);
  }

  @Put('preferences')
  updatePreferences(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: unknown,
  ) {
    return this.preferencesService.updateGlobal(
      user.id,
      updateGlobalPreferencesSchema.parse(body),
    );
  }

  @Put('preferences/events/:eventType')
  upsertEventPreference(
    @CurrentUser() user: AuthenticatedUser,
    @Param('eventType') eventType: string,
    @Body() body: unknown,
  ) {
    return this.preferencesService.upsertEventPreference(
      user.id,
      eventType,
      updateEventPreferenceSchema.parse(body),
    );
  }

  @Delete('preferences/events/:eventType')
  async removeEventPreference(
    @CurrentUser() user: AuthenticatedUser,
    @Param('eventType') eventType: string,
  ) {
    await this.preferencesService.removeEventPreference(user.id, eventType);
    return { ok: true };
  }
}
