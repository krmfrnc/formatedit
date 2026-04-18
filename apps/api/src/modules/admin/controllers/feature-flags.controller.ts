import { Body, Controller, Delete, Get, Param, Put, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../../common/auth/current-user.decorator';
import { JwtAuthGuard } from '../../../common/auth/jwt-auth.guard';
import { Roles } from '../../../common/auth/roles.decorator';
import { RolesGuard } from '../../../common/auth/roles.guard';
import type { AuthenticatedUser } from '../../../common/auth/authenticated-user.interface';
import { FeatureFlagsService } from '../services/feature-flags.service';
import { upsertFeatureFlagSchema } from '../schemas/feature-flag.schema';

@Controller('admin/feature-flags')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class FeatureFlagsController {
  constructor(private readonly featureFlagsService: FeatureFlagsService) {}

  @Get()
  async list() {
    return this.featureFlagsService.list();
  }

  @Get(':key')
  async get(@Param('key') key: string) {
    return this.featureFlagsService.get(key);
  }

  @Put(':key')
  async upsert(
    @Param('key') key: string,
    @CurrentUser() actor: AuthenticatedUser,
    @Body() body: unknown,
  ) {
    const parsed = upsertFeatureFlagSchema.parse({ ...(body as Record<string, unknown>), key });
    return this.featureFlagsService.upsert(parsed, actor.id);
  }

  @Delete(':key')
  async remove(@Param('key') key: string) {
    await this.featureFlagsService.delete(key);
    return { ok: true };
  }
}
