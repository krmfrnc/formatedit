import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { AffiliateModule } from '../affiliate/affiliate.module';
import { AuditModule } from '../audit/audit.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { CouponsService } from './coupons.service';
import { FraudDetectionService } from './fraud-detection.service';
import { InvoicesService } from './invoices.service';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { PaymentsWebhookController } from './payments-webhook.controller';
import { PaymentsWebhookService } from './payments-webhook.service';

@Module({
  imports: [
    AffiliateModule,
    AuditModule,
    NotificationsModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.getOrThrow<string>('jwtSecret'),
      }),
    }),
  ],
  controllers: [PaymentsController, PaymentsWebhookController],
  providers: [
    PaymentsService,
    PaymentsWebhookService,
    CouponsService,
    FraudDetectionService,
    InvoicesService,
    JwtAuthGuard,
  ],
  exports: [
    PaymentsService,
    PaymentsWebhookService,
    CouponsService,
    FraudDetectionService,
    InvoicesService,
  ],
})
export class PaymentsModule {}
