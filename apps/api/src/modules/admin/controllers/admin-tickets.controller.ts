import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import type { AnalysisTicketStatus } from '@prisma/client';
import { JwtAuthGuard } from '../../../common/auth/jwt-auth.guard';
import { Roles } from '../../../common/auth/roles.decorator';
import { RolesGuard } from '../../../common/auth/roles.guard';
import { AdminTicketsService } from '../services/admin-tickets.service';
import { assignExpertSchema } from '../schemas/admin-user.schema';

@Controller('admin/tickets')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class AdminTicketsController {
  constructor(private readonly adminTicketsService: AdminTicketsService) {}

  @Get()
  async list(
    @Query('status') status?: AnalysisTicketStatus,
    @Query('expertId') expertId?: string,
    @Query('customerId') customerId?: string,
    @Query('take') take?: string,
    @Query('cursor') cursor?: string,
  ) {
    return this.adminTicketsService.list({
      status,
      expertId,
      customerId,
      take: take ? Number.parseInt(take, 10) : undefined,
      cursor,
    });
  }

  @Patch(':id/assignment')
  async assign(@Param('id') id: string, @Body() body: unknown) {
    const parsed = assignExpertSchema.parse(body);
    return this.adminTicketsService.assignExpert(id, parsed.expertUserId);
  }
}
