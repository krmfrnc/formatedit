import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { RolesGuard } from '../../common/auth/roles.guard';
import { SupportAdminController, SupportController } from './support.controller';
import { SupportService } from './support.service';
import { SupportChannelService } from './support-channel.service';

@Module({
  imports: [
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.getOrThrow<string>('jwtSecret'),
      }),
    }),
  ],
  controllers: [SupportController, SupportAdminController],
  providers: [SupportService, SupportChannelService, JwtAuthGuard, RolesGuard],
  exports: [SupportService, SupportChannelService],
})
export class SupportModule {}
