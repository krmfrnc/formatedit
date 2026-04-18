import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { RolesGuard } from '../../common/auth/roles.guard';
import {
  AffiliateAdminController,
  AffiliateProfileController,
  AffiliateTrackController,
} from './affiliate.controller';
import { AffiliateService } from './affiliate.service';

@Module({
  imports: [
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.getOrThrow<string>('jwtSecret'),
      }),
    }),
  ],
  controllers: [AffiliateTrackController, AffiliateProfileController, AffiliateAdminController],
  providers: [AffiliateService, JwtAuthGuard, RolesGuard],
  exports: [AffiliateService],
})
export class AffiliateModule {}
