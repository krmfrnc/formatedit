import { Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import type { AuthenticatedUser } from '../../common/auth/authenticated-user.interface';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { DocumentParserService } from './document-parser.service';

@Controller('documents')
@UseGuards(JwtAuthGuard)
export class DocumentParserController {
  constructor(private readonly documentParserService: DocumentParserService) {}

  @Get(':documentId/parse-result')
  getParseResult(
    @CurrentUser() user: AuthenticatedUser,
    @Param('documentId') documentId: string,
  ) {
    return this.documentParserService.getParseResultForUser(
      user.id,
      documentId,
    );
  }

  @Get(':documentId/outline')
  getOutline(
    @CurrentUser() user: AuthenticatedUser,
    @Param('documentId') documentId: string,
  ) {
    return this.documentParserService.getOutlineForUser(user.id, documentId);
  }

  @Get(':documentId/confidence')
  getConfidence(
    @CurrentUser() user: AuthenticatedUser,
    @Param('documentId') documentId: string,
  ) {
    return this.documentParserService.getConfidenceForUser(user.id, documentId);
  }

  @Get(':documentId/parse-diagnostics')
  getDiagnostics(
    @CurrentUser() user: AuthenticatedUser,
    @Param('documentId') documentId: string,
  ) {
    return this.documentParserService.getDiagnosticsForUser(
      user.id,
      documentId,
    );
  }

  @Get(':documentId/parse-metrics')
  getMetrics(
    @CurrentUser() user: AuthenticatedUser,
    @Param('documentId') documentId: string,
  ) {
    return this.documentParserService.getMetricsForUser(user.id, documentId);
  }

  @Get(':documentId/section-matching')
  getSectionMatching(
    @CurrentUser() user: AuthenticatedUser,
    @Param('documentId') documentId: string,
    @Query('templateId') templateId?: string,
    @Query('workType') workType?: string,
  ) {
    return this.documentParserService.getSectionMatchingForDocument(
      user.id,
      documentId,
      templateId,
      workType,
    );
  }

  @Post(':documentId/parse/retry')
  retryParse(
    @CurrentUser() user: AuthenticatedUser,
    @Param('documentId') documentId: string,
  ) {
    return this.documentParserService.queueParseRetry(user.id, documentId);
  }

  @Post(':documentId/versions/:versionId/pdf-convert')
  queuePdfConversion(
    @CurrentUser() user: AuthenticatedUser,
    @Param('documentId') documentId: string,
    @Param('versionId') versionId: string,
  ) {
    return this.documentParserService.queuePdfConversionForUser(
      user.id,
      documentId,
      versionId,
    );
  }
}
