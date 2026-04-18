import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { RolesGuard } from '../../common/auth/roles.guard';
import { AuditModule } from '../audit/audit.module';
import { DocumentsModule } from '../documents/documents.module';
import { QueueModule } from '../queue/queue.module';
import { EmailChannelAdapter } from './adapters/email.adapter';
import { InAppChannelAdapter } from './adapters/inapp.adapter';
import { TelegramChannelAdapter } from './adapters/telegram.adapter';
import { WhatsAppChannelAdapter } from './adapters/whatsapp.adapter';
import { NotificationsAdminController } from './notifications-admin.controller';
import { NotificationPreferencesService } from './notification-preferences.service';
import { NotificationTemplateEngine } from './notification-template.engine';
import { NotificationsController } from './notifications.controller';
import { NotificationsGateway } from './notifications.gateway';
import { NotificationsService } from './notifications.service';
import { NotificationsWorker } from './notifications.worker';
import { SystemSettingsAdminController } from './system-settings-admin.controller';
import { SystemSettingsService } from './system-settings.service';

@Module({
  imports: [
    AuditModule,
    DocumentsModule,
    QueueModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.getOrThrow<string>('jwtSecret'),
      }),
    }),
  ],
  controllers: [
    NotificationsController,
    NotificationsAdminController,
    SystemSettingsAdminController,
  ],
  providers: [
    NotificationsService,
    NotificationPreferencesService,
    NotificationTemplateEngine,
    SystemSettingsService,
    NotificationsGateway,
    NotificationsWorker,
    EmailChannelAdapter,
    InAppChannelAdapter,
    WhatsAppChannelAdapter,
    TelegramChannelAdapter,
    JwtAuthGuard,
    RolesGuard,
  ],
  exports: [NotificationsService],
})
export class NotificationsModule {}
