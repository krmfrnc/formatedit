import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { RolesGuard } from '../../common/auth/roles.guard';
import { AuditModule } from '../audit/audit.module';
import { CitationModule } from '../citations/citation.module';
import { DocumentParserModule } from '../document-parser/document-parser.module';
import { QueueModule } from '../queue/queue.module';
import { StorageModule } from '../storage/storage.module';
import { ClamAvService } from './clamav.service';
import { DocumentRateLimitService } from './document-rate-limit.service';
import { DocumentPreviewGateway } from './document-preview.gateway';
import { DocumentPreviewService } from './document-preview.service';
import { DocumentSecuritySettingsService } from './document-security-settings.service';
import { DocumentVirusScanService } from './document-virus-scan.service';
import { DocumentsController } from './documents.controller';
import { DocumentsService } from './documents.service';
import { VirusTotalService } from './virustotal.service';

@Module({
  imports: [
    AuditModule,
    CitationModule,
    DocumentParserModule,
    QueueModule,
    StorageModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.getOrThrow<string>('jwtSecret'),
      }),
    }),
  ],
  controllers: [DocumentsController],
  providers: [
    DocumentsService,
    DocumentRateLimitService,
    DocumentPreviewGateway,
    DocumentPreviewService,
    DocumentSecuritySettingsService,
    DocumentVirusScanService,
    ClamAvService,
    VirusTotalService,
    JwtAuthGuard,
    RolesGuard,
  ],
  exports: [
    DocumentsService,
    DocumentPreviewService,
    DocumentSecuritySettingsService,
    DocumentVirusScanService,
  ],
})
export class DocumentsModule {}
