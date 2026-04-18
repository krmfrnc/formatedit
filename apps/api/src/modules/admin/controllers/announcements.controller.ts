import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../../../common/auth/current-user.decorator';
import { JwtAuthGuard } from '../../../common/auth/jwt-auth.guard';
import { Roles } from '../../../common/auth/roles.decorator';
import { RolesGuard } from '../../../common/auth/roles.guard';
import type { AuthenticatedUser } from '../../../common/auth/authenticated-user.interface';
import { AnnouncementsService } from '../services/announcements.service';
import { upsertAnnouncementSchema } from '../schemas/announcement.schema';

@Controller('admin/announcements')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class AnnouncementsAdminController {
  constructor(private readonly announcementsService: AnnouncementsService) {}

  @Get()
  async list() {
    return this.announcementsService.listAll();
  }

  @Post()
  async create(@CurrentUser() actor: AuthenticatedUser, @Body() body: unknown) {
    const parsed = upsertAnnouncementSchema.parse(body);
    return this.announcementsService.create(parsed, actor.id);
  }

  @Put(':id')
  async update(@Param('id') id: string, @Body() body: unknown) {
    const parsed = upsertAnnouncementSchema.parse(body);
    return this.announcementsService.update(id, parsed);
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    await this.announcementsService.delete(id);
    return { ok: true };
  }
}

/**
 * Public-facing read endpoint used by the banner component to fetch the
 * currently-active announcements without authentication.
 */
@Controller('announcements')
export class AnnouncementsPublicController {
  constructor(private readonly announcementsService: AnnouncementsService) {}

  @Get('active')
  async listActive() {
    return this.announcementsService.listActive();
  }
}
