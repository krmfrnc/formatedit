import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { QueueModule } from '../queue/queue.module';
import { StorageModule } from '../storage/storage.module';
import { DocxAiHeadingService } from './docx-ai-heading.service';
import { DocumentPipelineWorkerService } from './document-pipeline.worker.service';
import { DocumentParserController } from './document-parser.controller';
import { DocumentParserService } from './document-parser.service';
import { PdfConversionWorker } from './pdf-conversion.worker';
import { SectionMatcherService } from './section-matcher.service';

@Module({
  imports: [
    QueueModule,
    StorageModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.getOrThrow<string>('jwtSecret'),
      }),
    }),
  ],
  controllers: [DocumentParserController],
  providers: [
    DocumentParserService,
    DocxAiHeadingService,
    JwtAuthGuard,
    PdfConversionWorker,
    DocumentPipelineWorkerService,
    SectionMatcherService,
  ],
  exports: [DocumentParserService, SectionMatcherService],
})
export class DocumentParserModule {}
