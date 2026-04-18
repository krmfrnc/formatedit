import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import type { AuthenticatedUser } from '../../common/auth/authenticated-user.interface';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { Roles } from '../../common/auth/roles.decorator';
import { RolesGuard } from '../../common/auth/roles.guard';
import { cloneTemplateSchema } from './schemas/clone-template.schema';
import { createUserTemplateSchema } from './schemas/create-user-template.schema';
import { importTemplatesSchema } from './schemas/import-templates.schema';
import { promoteUserTemplateSchema } from './schemas/promote-user-template.schema';
import { updateUserTemplateSchema } from './schemas/update-user-template.schema';
import { upsertWorkTypeSettingSchema } from './schemas/upsert-work-type-setting.schema';
import { upsertTemplateSchema } from './schemas/upsert-template.schema';
import { TemplatesService } from './templates.service';

@Controller()
export class TemplatesController {
  constructor(private readonly templatesService: TemplatesService) {}

  @Get('templates')
  @UseGuards(JwtAuthGuard)
  listOfficialTemplates(@Query('workType') workType?: string) {
    return this.templatesService.listOfficialTemplates(workType);
  }

  @Get('template-work-types')
  @UseGuards(JwtAuthGuard)
  listActiveWorkTypes() {
    return this.templatesService.listActiveWorkTypeSettings();
  }

  @Get('templates/me/custom')
  @UseGuards(JwtAuthGuard)
  listMyTemplates(@CurrentUser() user: AuthenticatedUser) {
    return this.templatesService.listUserTemplates(user.id);
  }

  @Post('templates/me/custom')
  @UseGuards(JwtAuthGuard)
  createMyTemplate(@CurrentUser() user: AuthenticatedUser, @Body() body: unknown) {
    return this.templatesService.createUserTemplate(
      user.id,
      createUserTemplateSchema.parse(body),
    );
  }

  @Patch('templates/me/custom/:userTemplateId')
  @UseGuards(JwtAuthGuard)
  updateMyTemplate(
    @CurrentUser() user: AuthenticatedUser,
    @Param('userTemplateId') userTemplateId: string,
    @Body() body: unknown,
  ) {
    return this.templatesService.updateUserTemplate(
      user.id,
      userTemplateId,
      updateUserTemplateSchema.parse(body),
    );
  }

  @Delete('templates/me/custom/:userTemplateId')
  @UseGuards(JwtAuthGuard)
  archiveMyTemplate(
    @CurrentUser() user: AuthenticatedUser,
    @Param('userTemplateId') userTemplateId: string,
  ) {
    return this.templatesService.archiveUserTemplate(user.id, userTemplateId);
  }

  @Post('templates/:templateId/clone')
  @UseGuards(JwtAuthGuard)
  cloneTemplate(
    @CurrentUser() user: AuthenticatedUser,
    @Param('templateId') templateId: string,
    @Body() body: unknown,
  ) {
    return this.templatesService.cloneOfficialTemplate(user.id, templateId, cloneTemplateSchema.parse(body));
  }

  @Get('templates/:templateId')
  @UseGuards(JwtAuthGuard)
  getOfficialTemplate(@Param('templateId') templateId: string) {
    return this.templatesService.getOfficialTemplate(templateId);
  }

  @Get('admin/templates')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'SUPER_ADMIN')
  adminListTemplates() {
    return this.templatesService.adminListTemplates();
  }

  @Get('admin/templates/stats')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'SUPER_ADMIN')
  adminTemplateStats() {
    return this.templatesService.adminTemplateStats();
  }

  @Get('admin/template-work-types')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'SUPER_ADMIN')
  adminListWorkTypes() {
    return this.templatesService.adminListWorkTypeSettings();
  }

  @Get('admin/templates/export')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'SUPER_ADMIN')
  adminExportTemplates() {
    return this.templatesService.adminExportTemplates();
  }

  @Post('admin/templates/import')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'SUPER_ADMIN')
  adminImportTemplates(@CurrentUser() user: AuthenticatedUser, @Body() body: unknown) {
    return this.templatesService.adminImportTemplates(user.id, importTemplatesSchema.parse(body));
  }

  @Post('admin/templates')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'SUPER_ADMIN')
  adminCreateTemplate(@CurrentUser() user: AuthenticatedUser, @Body() body: unknown) {
    return this.templatesService.adminCreateTemplate(user.id, upsertTemplateSchema.parse(body));
  }

  @Post('admin/template-work-types')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'SUPER_ADMIN')
  adminCreateWorkType(@CurrentUser() user: AuthenticatedUser, @Body() body: unknown) {
    return this.templatesService.adminCreateWorkTypeSetting(user.id, upsertWorkTypeSettingSchema.parse(body));
  }

  @Patch('admin/templates/:templateId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'SUPER_ADMIN')
  adminUpdateTemplate(
    @CurrentUser() user: AuthenticatedUser,
    @Param('templateId') templateId: string,
    @Body() body: unknown,
  ) {
    return this.templatesService.adminUpdateTemplate(user.id, templateId, upsertTemplateSchema.parse(body));
  }

  @Delete('admin/templates/:templateId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'SUPER_ADMIN')
  adminDeleteTemplate(@CurrentUser() user: AuthenticatedUser, @Param('templateId') templateId: string) {
    return this.templatesService.adminDeleteTemplate(user.id, templateId);
  }

  @Patch('admin/template-work-types/:workTypeId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'SUPER_ADMIN')
  adminUpdateWorkType(
    @CurrentUser() user: AuthenticatedUser,
    @Param('workTypeId') workTypeId: string,
    @Body() body: unknown,
  ) {
    return this.templatesService.adminUpdateWorkTypeSetting(
      user.id,
      workTypeId,
      upsertWorkTypeSettingSchema.parse(body),
    );
  }

  @Delete('admin/template-work-types/:workTypeId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'SUPER_ADMIN')
  adminDeleteWorkType(@CurrentUser() user: AuthenticatedUser, @Param('workTypeId') workTypeId: string) {
    return this.templatesService.adminDeleteWorkTypeSetting(user.id, workTypeId);
  }

  @Post('admin/templates/promote/:userTemplateId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'SUPER_ADMIN')
  adminPromoteUserTemplate(
    @CurrentUser() user: AuthenticatedUser,
    @Param('userTemplateId') userTemplateId: string,
    @Body() body: unknown,
  ) {
    return this.templatesService.adminPromoteUserTemplate(
      user.id,
      userTemplateId,
      promoteUserTemplateSchema.parse(body),
    );
  }
}
