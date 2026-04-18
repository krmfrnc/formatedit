import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { AuditModule } from '../audit/audit.module';
import { StudentVerificationController } from './student-verification.controller';
import { StudentVerificationService } from './student-verification.service';

@Module({
  imports: [
    AuditModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.getOrThrow<string>('jwtSecret'),
      }),
    }),
  ],
  controllers: [StudentVerificationController],
  providers: [StudentVerificationService, JwtAuthGuard],
  exports: [StudentVerificationService],
})
export class StudentVerificationModule {}
