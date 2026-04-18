import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import type { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../../../common/auth/jwt-auth.guard';
import { Roles } from '../../../common/auth/roles.decorator';
import { RolesGuard } from '../../../common/auth/roles.guard';
import { AdminUsersService } from '../services/admin-users.service';
import {
  setEmailVerifiedSchema,
  updateUserRoleSchema,
} from '../schemas/admin-user.schema';

@Controller('admin/users')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class AdminUsersController {
  constructor(private readonly adminUsersService: AdminUsersService) {}

  @Get()
  async list(
    @Query('search') search?: string,
    @Query('role') role?: UserRole,
    @Query('take') take?: string,
    @Query('cursor') cursor?: string,
  ) {
    return this.adminUsersService.list({
      search,
      role,
      take: take ? Number.parseInt(take, 10) : undefined,
      cursor,
    });
  }

  @Patch(':id/role')
  async updateRole(@Param('id') id: string, @Body() body: unknown) {
    const parsed = updateUserRoleSchema.parse(body);
    return this.adminUsersService.updateRole(id, parsed.role);
  }

  @Patch(':id/email-verified')
  async setEmailVerified(@Param('id') id: string, @Body() body: unknown) {
    const parsed = setEmailVerifiedSchema.parse(body);
    return this.adminUsersService.setEmailVerified(id, parsed.verified);
  }
}
