import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import type { LegalDocumentSlug } from '@prisma/client';
import { CurrentUser } from '../../../common/auth/current-user.decorator';
import { JwtAuthGuard } from '../../../common/auth/jwt-auth.guard';
import { Roles } from '../../../common/auth/roles.decorator';
import { RolesGuard } from '../../../common/auth/roles.guard';
import type { AuthenticatedUser } from '../../../common/auth/authenticated-user.interface';
import { LegalDocumentsService } from '../services/legal-documents.service';
import { createLegalDraftSchema } from '../schemas/legal-document.schema';

@Controller('admin/legal-documents')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class LegalDocumentsAdminController {
  constructor(private readonly legalDocumentsService: LegalDocumentsService) {}

  @Get()
  async list(
    @Query('slug') slug?: LegalDocumentSlug,
    @Query('locale') locale?: string,
  ) {
    return this.legalDocumentsService.list(slug, locale);
  }

  @Post('drafts')
  async createDraft(@CurrentUser() actor: AuthenticatedUser, @Body() body: unknown) {
    const parsed = createLegalDraftSchema.parse(body);
    return this.legalDocumentsService.createDraft(parsed, actor.id);
  }

  @Post(':id/publish')
  async publish(@Param('id') id: string, @CurrentUser() actor: AuthenticatedUser) {
    return this.legalDocumentsService.publish(id, actor.id);
  }

  @Post(':id/unpublish')
  async unpublish(@Param('id') id: string, @CurrentUser() actor: AuthenticatedUser) {
    return this.legalDocumentsService.unpublish(id, actor.id);
  }
}

/**
 * Public endpoint used by site footer / legal pages to fetch the active
 * version of a given slug+locale.
 */
@Controller('legal')
export class LegalDocumentsPublicController {
  constructor(private readonly legalDocumentsService: LegalDocumentsService) {}

  @Get(':slug')
  async getActive(
    @Param('slug') slug: LegalDocumentSlug,
    @Query('locale') locale?: string,
  ) {
    return this.legalDocumentsService.getActive(slug, locale ?? 'tr');
  }
}
