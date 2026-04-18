import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import type { SupportTicketStatus } from '@prisma/client';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { Roles } from '../../common/auth/roles.decorator';
import { RolesGuard } from '../../common/auth/roles.guard';
import type { AuthenticatedUser } from '../../common/auth/authenticated-user.interface';
import {
  createSupportTicketSchema,
  replySupportTicketSchema,
} from './schemas/support.schema';
import { SupportService } from './support.service';

@Controller('support/tickets')
@UseGuards(JwtAuthGuard)
export class SupportController {
  constructor(private readonly supportService: SupportService) {}

  @Get()
  async listMine(@CurrentUser() user: AuthenticatedUser) {
    return this.supportService.listForUser(user.id);
  }

  @Post()
  async create(@CurrentUser() user: AuthenticatedUser, @Body() body: unknown) {
    const parsed = createSupportTicketSchema.parse(body);
    return this.supportService.create({ userId: user.id, ...parsed });
  }

  @Get(':id')
  async history(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.supportService.history(id, user.id, user.role === 'ADMIN');
  }

  @Post(':id/reply')
  async reply(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    const parsed = replySupportTicketSchema.parse(body);
    const isAdmin = user.role === 'ADMIN';
    return this.supportService.reply({
      ticketId: id,
      senderUserId: user.id,
      senderRole: isAdmin ? 'ADMIN' : 'USER',
      body: parsed.body,
      isAdmin,
    });
  }

  @Post(':id/close')
  async close(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.supportService.close(id, user.id, user.role === 'ADMIN');
  }
}

@Controller('admin/support/tickets')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class SupportAdminController {
  constructor(private readonly supportService: SupportService) {}

  @Get()
  async list(@Query('status') status?: SupportTicketStatus) {
    return this.supportService.listAll(status);
  }
}
