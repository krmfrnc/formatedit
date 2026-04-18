import {
  Body,
  Controller,
  Get,
  Headers,
  NotFoundException,
  Param,
  Post,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { Roles } from '../../common/auth/roles.decorator';
import { RolesGuard } from '../../common/auth/roles.guard';
import type { AuthenticatedUser } from '../../common/auth/authenticated-user.interface';
import { AffiliateService } from './affiliate.service';
import {
  attachReferredUserSchema,
  recordVisitSchema,
  setCommissionSchema,
  setRewardStatusSchema,
} from './schemas/affiliate.schema';

/**
 * Public referral tracking endpoint. Frontend reads `?ref=CODE` from the
 * URL on the landing page and POSTs here to register the visit.
 */
@Controller('affiliates/track')
export class AffiliateTrackController {
  constructor(private readonly affiliateService: AffiliateService) {}

  @Post()
  async track(
    @Body() body: unknown,
    @Req() req: Request,
    @Headers('x-forwarded-for') forwarded?: string,
  ) {
    const parsed = recordVisitSchema.parse(body);
    const ip = forwarded?.split(',')[0]?.trim() ?? req.ip ?? null;
    const referral = await this.affiliateService.recordVisit({
      code: parsed.code,
      ip,
      landingUrl: parsed.landingUrl ?? null,
    });
    return { referralId: referral?.id ?? null };
  }

  @Post('attach')
  async attach(@Body() body: unknown) {
    const parsed = attachReferredUserSchema.parse(body);
    const referral = await this.affiliateService.attachReferredUser(
      parsed.referralId,
      parsed.newUserId,
    );
    return { ok: Boolean(referral) };
  }
}

@Controller('affiliates/me')
@UseGuards(JwtAuthGuard)
export class AffiliateProfileController {
  constructor(private readonly affiliateService: AffiliateService) {}

  @Get()
  async summary(@CurrentUser() user: AuthenticatedUser) {
    const summary = await this.affiliateService.summary(user.id);
    if (!summary) throw new NotFoundException('Not enrolled');
    return summary;
  }

  @Post('enroll')
  async enroll(@CurrentUser() user: AuthenticatedUser) {
    const affiliate = await this.affiliateService.enroll(user.id);
    return this.affiliateService.summary(user.id) ?? affiliate;
  }
}

@Controller('admin/affiliates')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class AffiliateAdminController {
  constructor(private readonly affiliateService: AffiliateService) {}

  @Get()
  async list() {
    return this.affiliateService.listAll();
  }

  @Get('payouts')
  async payouts() {
    return this.affiliateService.payoutReport();
  }

  @Put(':id/commission')
  async setCommission(@Param('id') id: string, @Body() body: unknown) {
    const parsed = setCommissionSchema.parse(body);
    return this.affiliateService.setCommissionPercent(id, parsed.commissionPercent);
  }

  @Put('rewards/:id/status')
  async setRewardStatus(@Param('id') id: string, @Body() body: unknown) {
    const parsed = setRewardStatusSchema.parse(body);
    return this.affiliateService.setRewardStatus(id, parsed.status);
  }
}
