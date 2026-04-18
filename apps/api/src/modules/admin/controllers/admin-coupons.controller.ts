import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../../common/auth/jwt-auth.guard';
import { Roles } from '../../../common/auth/roles.decorator';
import { RolesGuard } from '../../../common/auth/roles.guard';
import { CouponsService } from '../../payments/coupons.service';

/**
 * Task 290: Admin coupon listing. Create/update/delete is intentionally
 * not yet exposed — coupons are seeded via migration/CLI for the initial
 * launch. This endpoint surfaces the catalog for the admin UI.
 */
@Controller('admin/coupons')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class AdminCouponsController {
  constructor(private readonly couponsService: CouponsService) {}

  @Get()
  async list() {
    return this.couponsService.listAll();
  }
}
