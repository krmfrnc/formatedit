import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import type { AuthenticatedUser } from '../../common/auth/authenticated-user.interface';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { Roles } from '../../common/auth/roles.decorator';
import { RolesGuard } from '../../common/auth/roles.guard';
import { DocumentSecuritySettingsService } from '../documents/document-security-settings.service';
import { UpdateDocumentSecuritySettingsDto } from '../documents/dto/update-document-security-settings.dto';
import { updateDocumentSecuritySettingsSchema } from '../documents/schemas/update-document-security-settings.schema';
import { UpdateBackupSettingsDto } from './dto/update-backup-settings.dto';
import { UpdateSupportedLanguagesDto } from './dto/update-supported-languages.dto';
import { updateBackupSettingsSchema } from './schemas/update-backup-settings.schema';
import { updateSupportedLanguagesSchema } from './schemas/update-supported-languages.schema';
import { SystemSettingsService } from './system-settings.service';

/**
 * Task 292 / 293: Admin surface for backup cadence and virus-scan settings.
 */
@Controller('admin/system-settings')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN', 'SUPER_ADMIN')
export class SystemSettingsAdminController {
  constructor(
    private readonly systemSettingsService: SystemSettingsService,
    private readonly documentSecuritySettingsService: DocumentSecuritySettingsService,
  ) {}

  @Get()
  async getSnapshot() {
    const [backup, languages, documentSecurity] = await Promise.all([
      this.systemSettingsService.getBackupSettings(),
      this.systemSettingsService.getSupportedLanguages(),
      this.documentSecuritySettingsService.getPolicy(),
    ]);

    return {
      backup,
      languages,
      documentSecurity,
    };
  }

  @Patch('backup')
  updateBackupSettings(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() body: UpdateBackupSettingsDto,
  ) {
    return this.systemSettingsService.updateBackupSettings(
      updateBackupSettingsSchema.parse(body),
      actor.id,
    );
  }

  @Patch('languages')
  updateSupportedLanguages(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() body: UpdateSupportedLanguagesDto,
  ) {
    return this.systemSettingsService.updateSupportedLanguages(
      updateSupportedLanguagesSchema.parse(body).items,
      actor.id,
    );
  }

  @Patch('document-security')
  updateDocumentSecuritySettings(@Body() body: UpdateDocumentSecuritySettingsDto) {
    return this.documentSecuritySettingsService.updatePolicy(
      updateDocumentSecuritySettingsSchema.parse(body),
    );
  }
}
