import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { RolesGuard } from '../../common/auth/roles.guard';
import { PaymentsModule } from '../payments/payments.module';
import { AdminCouponsController } from './controllers/admin-coupons.controller';
import { AdminTicketsController } from './controllers/admin-tickets.controller';
import { AdminUsersController } from './controllers/admin-users.controller';
import { AnalyticsController } from './controllers/analytics.controller';
import {
  AnnouncementsAdminController,
  AnnouncementsPublicController,
} from './controllers/announcements.controller';
import { FeatureFlagsController } from './controllers/feature-flags.controller';
import {
  LegalDocumentsAdminController,
  LegalDocumentsPublicController,
} from './controllers/legal-documents.controller';
import { PrometheusController } from './controllers/prometheus.controller';
import { AdminTicketsService } from './services/admin-tickets.service';
import { AdminUsersService } from './services/admin-users.service';
import { AnalyticsReportService } from './services/analytics-report.service';
import { AnalyticsService } from './services/analytics.service';
import { AnnouncementsService } from './services/announcements.service';
import { FeatureFlagsService } from './services/feature-flags.service';
import { LegalDocumentsService } from './services/legal-documents.service';
import { PrometheusService } from './services/prometheus.service';
import { ReportExporterService } from './services/report-exporter.service';

/**
 * BATCH 12: Admin panel + analytics module.
 *
 * Hosts feature flags (T272), announcements (T288), legal documents (T289),
 * analytics aggregates (T278-282), report export (T283), scheduled report
 * jobs (T284-285), and Prometheus metrics (T286). All admin endpoints are
 * guarded by JWT + `@Roles('ADMIN')`; the public announcement/legal reads
 * intentionally skip auth so unauthenticated pages can render banners and
 * legal pages.
 */
@Module({
  imports: [
    PaymentsModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.getOrThrow<string>('jwtSecret'),
      }),
    }),
  ],
  controllers: [
    FeatureFlagsController,
    AnnouncementsAdminController,
    AnnouncementsPublicController,
    LegalDocumentsAdminController,
    LegalDocumentsPublicController,
    AnalyticsController,
    AdminUsersController,
    AdminTicketsController,
    AdminCouponsController,
    PrometheusController,
  ],
  providers: [
    FeatureFlagsService,
    AnnouncementsService,
    LegalDocumentsService,
    AnalyticsService,
    ReportExporterService,
    AnalyticsReportService,
    PrometheusService,
    AdminUsersService,
    AdminTicketsService,
    JwtAuthGuard,
    RolesGuard,
  ],
  exports: [FeatureFlagsService, AnnouncementsService, LegalDocumentsService, AnalyticsService],
})
export class AdminModule {}
