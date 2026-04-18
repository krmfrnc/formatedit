import {
  Body,
  Controller,
  Get,
  Put,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { Roles } from '../../common/auth/roles.decorator';
import { RolesGuard } from '../../common/auth/roles.guard';
import type { AuthenticatedUser } from '../../common/auth/authenticated-user.interface';
import { SystemSettingsService } from './system-settings.service';
import { updateChannelToggleSchema } from './schemas/update-preferences.schema';

/**
 * Task 264: Admin-facing endpoints that read / write the per-channel kill
 * switches from `system_settings`.
 */
@Controller('admin/notifications')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class NotificationsAdminController {
  constructor(private readonly systemSettingsService: SystemSettingsService) {}

  @Get('channels')
  async getChannels() {
    return this.systemSettingsService.getChannelStatuses();
  }

  @Put('channels')
  async updateChannel(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() body: unknown,
  ) {
    const { channel, enabled } = updateChannelToggleSchema.parse(body);
    await this.systemSettingsService.setChannelEnabled(channel, enabled, actor.id);
    return { channel, enabled };
  }
}
