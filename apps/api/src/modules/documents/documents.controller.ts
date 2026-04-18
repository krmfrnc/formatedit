import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UploadedFile,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import type { AuthenticatedUser } from '../../common/auth/authenticated-user.interface';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { Roles } from '../../common/auth/roles.decorator';
import { RolesGuard } from '../../common/auth/roles.guard';
import { CompleteDocumentUploadSessionDto } from './dto/complete-document-upload-session.dto';
import { CreateDocumentSnapshotDto } from './dto/create-document-snapshot.dto';
import { CreateDocumentUploadSessionDto } from './dto/create-document-upload-session.dto';
import { UpdateDocumentWorkingVersionDto } from './dto/update-document-working-version.dto';
import { UpdateDocumentSecuritySettingsDto } from './dto/update-document-security-settings.dto';
import { createDocumentSnapshotSchema } from './schemas/create-document-snapshot.schema';
import { completeDocumentUploadSessionSchema } from './schemas/complete-document-upload-session.schema';
import { createDocumentUploadSessionSchema } from './schemas/create-document-upload-session.schema';
import { updateDocumentWorkingVersionSchema } from './schemas/update-document-working-version.schema';
import { updateDocumentSecuritySettingsSchema } from './schemas/update-document-security-settings.schema';
import { DocumentsService } from './documents.service';

@Controller()
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  @Post('documents/upload')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
    }),
  )
  uploadDocument(
    @CurrentUser() user: AuthenticatedUser,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.documentsService.uploadDocument(user.id, file);
  }

  @Post('documents/upload/batch')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(
    FilesInterceptor('files', 10, {
      storage: memoryStorage(),
    }),
  )
  uploadDocumentBatch(
    @CurrentUser() user: AuthenticatedUser,
    @UploadedFiles() files: Express.Multer.File[],
  ) {
    return this.documentsService.uploadDocuments(user.id, files);
  }

  @Post('documents/upload-sessions')
  @UseGuards(JwtAuthGuard)
  createUploadSession(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: CreateDocumentUploadSessionDto,
  ) {
    return this.documentsService.createUploadSession(
      user.id,
      createDocumentUploadSessionSchema.parse(body),
    );
  }

  @Post('documents/upload-sessions/complete')
  @UseGuards(JwtAuthGuard)
  completeUploadSession(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: CompleteDocumentUploadSessionDto,
  ) {
    return this.documentsService.completeUploadSession(
      user.id,
      completeDocumentUploadSessionSchema.parse(body),
    );
  }

  @Get('documents/upload-sessions/:sessionId')
  @UseGuards(JwtAuthGuard)
  getUploadSession(
    @CurrentUser() user: AuthenticatedUser,
    @Param('sessionId') sessionId: string,
  ) {
    return this.documentsService.getUploadSession(user.id, sessionId);
  }

  @Get('documents')
  @UseGuards(JwtAuthGuard)
  listDocuments(@CurrentUser() user: AuthenticatedUser) {
    return this.documentsService.listDocuments(user.id);
  }

  @Get('documents/:documentId')
  @UseGuards(JwtAuthGuard)
  getDocumentDetail(@CurrentUser() user: AuthenticatedUser, @Param('documentId') documentId: string) {
    return this.documentsService.getDocumentDetail(user.id, documentId);
  }

  @Get('documents/:documentId/versions')
  @UseGuards(JwtAuthGuard)
  getVersionHistory(@CurrentUser() user: AuthenticatedUser, @Param('documentId') documentId: string) {
    return this.documentsService.getVersionHistory(user.id, documentId);
  }

  @Get('documents/:documentId/editor-state')
  @UseGuards(JwtAuthGuard)
  getEditorState(@CurrentUser() user: AuthenticatedUser, @Param('documentId') documentId: string) {
    return this.documentsService.getEditorState(user.id, documentId);
  }

  @Get('documents/:documentId/preview-state')
  @UseGuards(JwtAuthGuard)
  getPreviewState(@CurrentUser() user: AuthenticatedUser, @Param('documentId') documentId: string) {
    return this.documentsService.getPreviewState(user.id, documentId);
  }

  @Get('documents/:documentId/citation-validation')
  @UseGuards(JwtAuthGuard)
  getCitationValidationReport(
    @CurrentUser() user: AuthenticatedUser,
    @Param('documentId') documentId: string,
  ) {
    return this.documentsService.getCitationValidationReport(user.id, documentId);
  }

  @Patch('documents/:documentId/working-version')
  @UseGuards(JwtAuthGuard)
  updateWorkingVersion(
    @CurrentUser() user: AuthenticatedUser,
    @Param('documentId') documentId: string,
    @Body() body: UpdateDocumentWorkingVersionDto,
  ) {
    return this.documentsService.updateWorkingVersion(
      user.id,
      documentId,
      updateDocumentWorkingVersionSchema.parse(body),
    );
  }

  @Post('documents/:documentId/snapshots')
  @UseGuards(JwtAuthGuard)
  createSnapshot(
    @CurrentUser() user: AuthenticatedUser,
    @Param('documentId') documentId: string,
    @Body() body: CreateDocumentSnapshotDto,
  ) {
    return this.documentsService.createSnapshot(
      user.id,
      documentId,
      createDocumentSnapshotSchema.parse(body),
    );
  }

  @Get('documents/:documentId/versions/:versionId/diff/:compareVersionId')
  @UseGuards(JwtAuthGuard)
  getVersionDiff(
    @CurrentUser() user: AuthenticatedUser,
    @Param('documentId') documentId: string,
    @Param('versionId') versionId: string,
    @Param('compareVersionId') compareVersionId: string,
  ) {
    return this.documentsService.getVersionDiff(user.id, documentId, versionId, compareVersionId);
  }

  @Post('documents/:documentId/versions/:versionId/restore')
  @UseGuards(JwtAuthGuard)
  restoreVersion(
    @CurrentUser() user: AuthenticatedUser,
    @Param('documentId') documentId: string,
    @Param('versionId') versionId: string,
  ) {
    return this.documentsService.restoreVersion(user.id, documentId, versionId);
  }

  @Delete('documents/:documentId')
  @UseGuards(JwtAuthGuard)
  deleteDocument(@CurrentUser() user: AuthenticatedUser, @Param('documentId') documentId: string) {
    return this.documentsService.softDeleteDocument(user.id, documentId);
  }

  @Get('documents/:documentId/versions/:versionId/presigned-download')
  @UseGuards(JwtAuthGuard)
  getVersionDownloadUrl(
    @CurrentUser() user: AuthenticatedUser,
    @Param('documentId') documentId: string,
    @Param('versionId') versionId: string,
  ) {
    return this.documentsService.createVersionPresignedDownloadUrl(user.id, documentId, versionId);
  }

  @Get('documents/:documentId/download/final')
  @UseGuards(JwtAuthGuard)
  getFinalDownloadUrl(
    @CurrentUser() user: AuthenticatedUser,
    @Param('documentId') documentId: string,
  ) {
    return this.documentsService.getFinalDownloadUrl(user.id, documentId);
  }

  @Get('admin/document-security-settings')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'SUPER_ADMIN')
  getSecuritySettings() {
    return this.documentsService.getSecurityPolicy();
  }

  @Patch('admin/document-security-settings')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'SUPER_ADMIN')
  updateSecuritySettings(@Body() body: UpdateDocumentSecuritySettingsDto) {
    return this.documentsService.updateSecurityPolicy(
      updateDocumentSecuritySettingsSchema.parse(body),
    );
  }
}
