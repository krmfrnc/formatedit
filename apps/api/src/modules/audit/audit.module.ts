import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { RolesGuard } from '../../common/auth/roles.guard';
import { AuditController } from './audit.controller';
import { AuditEventEmitterService } from './audit-event-emitter.service';
import { AuditInterceptor } from './audit.interceptor';
import { AuditListener } from './audit.listener';
import { AuditRetentionService } from './audit-retention.service';
import { AuditService } from './audit.service';

@Module({
  imports: [
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.getOrThrow<string>('jwtSecret'),
      }),
    }),
  ],
  controllers: [AuditController],
  providers: [
    AuditService,
    AuditEventEmitterService,
    AuditListener,
    AuditRetentionService,
    JwtAuthGuard,
    RolesGuard,
    {
      provide: APP_INTERCEPTOR,
      useClass: AuditInterceptor,
    },
  ],
  exports: [AuditService, AuditEventEmitterService],
})
export class AuditModule {}
