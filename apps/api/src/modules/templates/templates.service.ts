import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type {
  TemplateRecord,
  TemplateParameterSet,
  UserTemplateRecord,
  WorkTypeSettingRecord,
} from '@formatedit/shared';
import { PrismaService } from '../../prisma.service';
import { AuditEventEmitterService } from '../audit/audit-event-emitter.service';
import type {
  TemplateUpsertInput,
  UserTemplateCloneInput,
  UserTemplateCreateInput,
  UserTemplateUpdateInput,
  WorkTypeSettingUpsertInput,
} from './templates.types';

@Injectable()
export class TemplatesService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly auditEventEmitter: AuditEventEmitterService,
  ) {}

  async listOfficialTemplates(workType?: string): Promise<TemplateRecord[]> {
    const templates = await this.prismaService.template.findMany({
      where: {
        isActive: true,
        isArchived: false,
        ...(workType ? { workType } : {}),
      },
      orderBy: [{ usageCount: 'desc' }, { createdAt: 'desc' }],
    });

    return templates.map((template) => this.toTemplateRecord(template));
  }

  async getOfficialTemplate(templateId: string): Promise<TemplateRecord> {
    const template = await this.prismaService.template.findUnique({
      where: { id: templateId },
    });

    if (!template || template.isArchived) {
      throw new NotFoundException('Template was not found');
    }

    return this.toTemplateRecord(template);
  }

  async adminListTemplates(): Promise<TemplateRecord[]> {
    const templates = await this.prismaService.template.findMany({
      where: { isArchived: false },
      orderBy: [{ updatedAt: 'desc' }],
    });

    return templates.map((template) => this.toTemplateRecord(template));
  }

  async listActiveWorkTypeSettings(): Promise<WorkTypeSettingRecord[]> {
    const records = await this.prismaService.workTypeSetting.findMany({
      where: { isActive: true },
      orderBy: [{ label: 'asc' }],
    });

    return records.map((record) => this.toWorkTypeSettingRecord(record));
  }

  async adminListWorkTypeSettings(): Promise<WorkTypeSettingRecord[]> {
    const records = await this.prismaService.workTypeSetting.findMany({
      orderBy: [{ label: 'asc' }],
    });

    return records.map((record) => this.toWorkTypeSettingRecord(record));
  }

  async adminCreateTemplate(userId: string, input: TemplateUpsertInput): Promise<TemplateRecord> {
    const existing = await this.prismaService.template.findUnique({
      where: { slug: input.slug },
    });

    if (existing) {
      throw new ConflictException('Template slug is already in use');
    }

    const template = await this.prismaService.template.create({
      data: {
        slug: input.slug,
        name: input.name,
        description: input.description,
        category: input.category,
        workType: input.workType,
        isActive: input.isActive ?? true,
        templateParameters: input.templateParameters as unknown as Prisma.InputJsonValue,
        createdByUserId: userId,
      },
    });

    this.auditEventEmitter.emit({
      eventType: 'templates.created',
      category: 'templates',
      actorUserId: userId,
      entityType: 'template',
      entityId: template.id,
      metadata: { slug: template.slug },
    });

    return this.toTemplateRecord(template);
  }

  async adminCreateWorkTypeSetting(
    userId: string,
    input: WorkTypeSettingUpsertInput,
  ): Promise<WorkTypeSettingRecord> {
    const existing = await this.prismaService.workTypeSetting.findUnique({
      where: { slug: input.slug },
    });

    if (existing) {
      throw new ConflictException('Work type slug is already in use');
    }

    const created = await this.prismaService.workTypeSetting.create({
      data: {
        slug: input.slug,
        label: input.label,
        isActive: input.isActive ?? true,
        requiredFixedPages: input.requiredFixedPages as unknown as Prisma.InputJsonValue,
        optionalFixedPages: input.optionalFixedPages as unknown as Prisma.InputJsonValue,
      },
    });

    this.auditEventEmitter.emit({
      eventType: 'work_types.created',
      category: 'templates',
      actorUserId: userId,
      entityType: 'work_type_setting',
      entityId: created.id,
    });

    return this.toWorkTypeSettingRecord(created);
  }

  /**
   * Hard rule (prompt.md): templates are immutable. "Update" actually creates
   * a new Template row that links back to the predecessor via
   * previousVersionId, then archives the predecessor. Existing UserTemplate
   * rows keep their `baseTemplateId` pointing at the historic version, which
   * is the intended behavior — a user's cloned template should not silently
   * drift when an admin revises the source.
   */
  async adminUpdateTemplate(
    userId: string,
    templateId: string,
    input: TemplateUpsertInput,
  ): Promise<TemplateRecord> {
    const template = await this.prismaService.template.findUnique({
      where: { id: templateId },
    });

    if (!template || template.isArchived) {
      throw new NotFoundException('Template was not found');
    }

    // Slug conflict only matters against other *live* templates.
    const slugOwner = await this.prismaService.template.findFirst({
      where: {
        slug: input.slug,
        isArchived: false,
        NOT: { id: templateId },
      },
    });

    if (slugOwner) {
      throw new ConflictException('Template slug is already in use');
    }

    const created = await this.prismaService.$transaction(async (tx) => {
      // Free the slug so the new row can reuse it — slug is globally unique.
      await tx.template.update({
        where: { id: template.id },
        data: {
          isArchived: true,
          slug: this.archivedSlug(template.id, template.slug),
        },
      });

      return tx.template.create({
        data: {
          slug: input.slug,
          name: input.name,
          description: input.description,
          category: input.category,
          workType: input.workType,
          isActive: input.isActive ?? template.isActive,
          version: template.version + 1,
          usageCount: template.usageCount,
          templateParameters: input.templateParameters as unknown as Prisma.InputJsonValue,
          createdByUserId: userId,
          previousVersionId: template.id,
        },
      });
    });

    this.auditEventEmitter.emit({
      eventType: 'templates.updated',
      category: 'templates',
      actorUserId: userId,
      entityType: 'template',
      entityId: created.id,
      metadata: {
        slug: created.slug,
        version: created.version,
        previousVersionId: template.id,
      },
    });

    return this.toTemplateRecord(created);
  }

  /**
   * Soft delete: archive instead of removing the row so the version chain
   * and any `UserTemplate.baseTemplateId` references stay intact.
   */
  async adminDeleteTemplate(userId: string, templateId: string): Promise<{ success: true }> {
    const template = await this.prismaService.template.findUnique({
      where: { id: templateId },
    });

    if (!template || template.isArchived) {
      throw new NotFoundException('Template was not found');
    }

    await this.prismaService.template.update({
      where: { id: templateId },
      data: {
        isArchived: true,
        isActive: false,
        slug: this.archivedSlug(template.id, template.slug),
      },
    });

    this.auditEventEmitter.emit({
      eventType: 'templates.deleted',
      category: 'templates',
      actorUserId: userId,
      entityType: 'template',
      entityId: templateId,
    });

    return { success: true };
  }

  private archivedSlug(id: string, slug: string): string {
    return `__archived__${id}__${slug}`.slice(0, 191);
  }

  async adminUpdateWorkTypeSetting(
    userId: string,
    workTypeId: string,
    input: WorkTypeSettingUpsertInput,
  ): Promise<WorkTypeSettingRecord> {
    const existing = await this.prismaService.workTypeSetting.findUnique({
      where: { id: workTypeId },
    });

    if (!existing) {
      throw new NotFoundException('Work type setting was not found');
    }

    const slugOwner = await this.prismaService.workTypeSetting.findUnique({
      where: { slug: input.slug },
    });

    if (slugOwner && slugOwner.id !== workTypeId) {
      throw new ConflictException('Work type slug is already in use');
    }

    const updated = await this.prismaService.workTypeSetting.update({
      where: { id: workTypeId },
      data: {
        slug: input.slug,
        label: input.label,
        isActive: input.isActive ?? existing.isActive,
        requiredFixedPages: input.requiredFixedPages as unknown as Prisma.InputJsonValue,
        optionalFixedPages: input.optionalFixedPages as unknown as Prisma.InputJsonValue,
      },
    });

    this.auditEventEmitter.emit({
      eventType: 'work_types.updated',
      category: 'templates',
      actorUserId: userId,
      entityType: 'work_type_setting',
      entityId: updated.id,
    });

    return this.toWorkTypeSettingRecord(updated);
  }

  async adminDeleteWorkTypeSetting(userId: string, workTypeId: string): Promise<{ success: true }> {
    const existing = await this.prismaService.workTypeSetting.findUnique({
      where: { id: workTypeId },
    });

    if (!existing) {
      throw new NotFoundException('Work type setting was not found');
    }

    await this.prismaService.workTypeSetting.delete({
      where: { id: workTypeId },
    });

    this.auditEventEmitter.emit({
      eventType: 'work_types.deleted',
      category: 'templates',
      actorUserId: userId,
      entityType: 'work_type_setting',
      entityId: workTypeId,
    });

    return { success: true };
  }

  async listUserTemplates(userId: string): Promise<UserTemplateRecord[]> {
    const templates = await this.prismaService.userTemplate.findMany({
      where: {
        userId,
        isArchived: false,
      },
      orderBy: [{ updatedAt: 'desc' }],
    });

    return templates.map((template) => this.toUserTemplateRecord(template));
  }

  async createUserTemplate(userId: string, input: UserTemplateCreateInput): Promise<UserTemplateRecord> {
    if (input.baseTemplateId) {
      const baseTemplate = await this.prismaService.template.findUnique({
        where: { id: input.baseTemplateId },
      });

      if (!baseTemplate) {
        throw new NotFoundException('Base template was not found');
      }
    }

    const userTemplate = await this.prismaService.userTemplate.create({
      data: {
        userId,
        baseTemplateId: input.baseTemplateId,
        name: input.name,
        description: input.description,
        templateParameters: input.templateParameters as unknown as Prisma.InputJsonValue,
      },
    });

    this.auditEventEmitter.emit({
      eventType: 'user_templates.created',
      category: 'templates',
      actorUserId: userId,
      entityType: 'user_template',
      entityId: userTemplate.id,
    });

    return this.toUserTemplateRecord(userTemplate);
  }

  async cloneOfficialTemplate(
    userId: string,
    templateId: string,
    input: UserTemplateCloneInput,
  ): Promise<UserTemplateRecord> {
    const template = await this.prismaService.template.findUnique({
      where: { id: templateId },
    });

    if (!template || template.isArchived) {
      throw new NotFoundException('Template was not found');
    }

    const userTemplate = await this.prismaService.userTemplate.create({
      data: {
        userId,
        baseTemplateId: template.id,
        name: input.name ?? `${template.name} kopyasi`,
        description: input.description ?? template.description ?? undefined,
        templateParameters: template.templateParameters as Prisma.InputJsonValue,
      },
    });

    await this.prismaService.template.update({
      where: { id: template.id },
      data: {
        usageCount: template.usageCount + 1,
      },
    });

    this.auditEventEmitter.emit({
      eventType: 'templates.cloned',
      category: 'templates',
      actorUserId: userId,
      entityType: 'user_template',
      entityId: userTemplate.id,
      metadata: {
        sourceTemplateId: template.id,
      },
    });

    return this.toUserTemplateRecord(userTemplate);
  }

  async updateUserTemplate(
    userId: string,
    userTemplateId: string,
    input: UserTemplateUpdateInput,
  ): Promise<UserTemplateRecord> {
    const userTemplate = await this.prismaService.userTemplate.findUnique({
      where: { id: userTemplateId },
    });

    if (!userTemplate || userTemplate.userId !== userId || userTemplate.isArchived) {
      throw new NotFoundException('User template was not found');
    }

    const updated = await this.prismaService.userTemplate.update({
      where: { id: userTemplateId },
      data: {
        name: input.name,
        description: input.description,
        templateParameters: input.templateParameters as unknown as Prisma.InputJsonValue,
      },
    });

    this.auditEventEmitter.emit({
      eventType: 'user_templates.updated',
      category: 'templates',
      actorUserId: userId,
      entityType: 'user_template',
      entityId: updated.id,
    });

    return this.toUserTemplateRecord(updated);
  }

  async archiveUserTemplate(userId: string, userTemplateId: string): Promise<{ success: true }> {
    const userTemplate = await this.prismaService.userTemplate.findUnique({
      where: { id: userTemplateId },
    });

    if (!userTemplate || userTemplate.userId !== userId || userTemplate.isArchived) {
      throw new NotFoundException('User template was not found');
    }

    await this.prismaService.userTemplate.update({
      where: { id: userTemplateId },
      data: {
        isArchived: true,
      },
    });

    this.auditEventEmitter.emit({
      eventType: 'user_templates.archived',
      category: 'templates',
      actorUserId: userId,
      entityType: 'user_template',
      entityId: userTemplateId,
    });

    return { success: true };
  }

  async adminTemplateStats() {
    const templates = await this.prismaService.template.findMany({
      where: { isArchived: false },
      orderBy: [{ usageCount: 'desc' }, { updatedAt: 'desc' }],
    });
    const userTemplates = await this.prismaService.userTemplate.findMany({
      orderBy: [{ updatedAt: 'desc' }],
    });

    return {
      officialCount: templates.length,
      activeOfficialCount: templates.filter((template) => template.isActive).length,
      userTemplateCount: userTemplates.length,
      promotedUserTemplateCount: userTemplates.filter((template) => template.isPromoted).length,
      archivedUserTemplateCount: userTemplates.filter((template) => template.isArchived).length,
      topOfficialTemplates: templates.slice(0, 5).map((template) => ({
        id: template.id,
        name: template.name,
        slug: template.slug,
        usageCount: template.usageCount,
        version: template.version,
      })),
    };
  }

  async adminExportTemplates() {
    const templates = await this.prismaService.template.findMany({
      where: { isArchived: false },
      orderBy: [{ updatedAt: 'desc' }],
    });
    const userTemplates = await this.prismaService.userTemplate.findMany({
      orderBy: [{ updatedAt: 'desc' }],
    });

    return {
      exportedAt: new Date().toISOString(),
      officialTemplates: templates.map((template) => this.toTemplateRecord(template)),
      userTemplates: userTemplates.map((template) => this.toUserTemplateRecord(template)),
    };
  }

  async adminImportTemplates(
    userId: string,
    input: {
      overwriteExisting?: boolean;
      officialTemplates: Array<{
        slug: string;
        name: string;
        description?: string;
        category: string;
        workType: string;
        isActive?: boolean;
        templateParameters: TemplateParameterSet;
      }>;
    },
  ) {
    let createdCount = 0;
    let updatedCount = 0;

    for (const templateInput of input.officialTemplates) {
      const existing = await this.prismaService.template.findFirst({
        where: { slug: templateInput.slug, isArchived: false },
      });

      if (existing) {
        if (!input.overwriteExisting) {
          continue;
        }

        // Immutable update: archive predecessor, create a new version row.
        await this.prismaService.$transaction(async (tx) => {
          await tx.template.update({
            where: { id: existing.id },
            data: {
              isArchived: true,
              slug: this.archivedSlug(existing.id, existing.slug),
            },
          });
          await tx.template.create({
            data: {
              slug: templateInput.slug,
              name: templateInput.name,
              description: templateInput.description,
              category: templateInput.category,
              workType: templateInput.workType,
              isActive: templateInput.isActive ?? existing.isActive,
              version: existing.version + 1,
              usageCount: existing.usageCount,
              templateParameters: templateInput.templateParameters as unknown as Prisma.InputJsonValue,
              createdByUserId: userId,
              previousVersionId: existing.id,
            },
          });
        });
        updatedCount += 1;
        continue;
      }

      await this.prismaService.template.create({
        data: {
          slug: templateInput.slug,
          name: templateInput.name,
          description: templateInput.description,
          category: templateInput.category,
          workType: templateInput.workType,
          isActive: templateInput.isActive ?? true,
          templateParameters: templateInput.templateParameters as unknown as Prisma.InputJsonValue,
          createdByUserId: userId,
        },
      });
      createdCount += 1;
    }

    this.auditEventEmitter.emit({
      eventType: 'templates.imported',
      category: 'templates',
      actorUserId: userId,
      entityType: 'template',
      metadata: {
        createdCount,
        updatedCount,
        overwriteExisting: input.overwriteExisting ?? false,
      },
    });

    return {
      success: true as const,
      createdCount,
      updatedCount,
      skippedCount: input.officialTemplates.length - createdCount - updatedCount,
    };
  }

  async adminPromoteUserTemplate(
    userId: string,
    userTemplateId: string,
    input: {
      slug: string;
      category: string;
      workType: string;
      name?: string;
      description?: string;
      isActive?: boolean;
    },
  ): Promise<TemplateRecord> {
    const userTemplate = await this.prismaService.userTemplate.findUnique({
      where: { id: userTemplateId },
    });

    if (!userTemplate || userTemplate.isArchived) {
      throw new NotFoundException('User template was not found');
    }

    const existingTemplate = await this.prismaService.template.findFirst({
      where: { slug: input.slug, isArchived: false },
    });

    if (existingTemplate) {
      throw new ConflictException('Template slug is already in use');
    }

    const promoted = await this.prismaService.template.create({
      data: {
        slug: input.slug,
        name: input.name ?? userTemplate.name,
        description: input.description ?? userTemplate.description,
        category: input.category,
        workType: input.workType,
        isActive: input.isActive ?? true,
        templateParameters: userTemplate.templateParameters as Prisma.InputJsonValue,
        createdByUserId: userId,
        sourceUserTemplateId: userTemplate.id,
      },
    });

    await this.prismaService.userTemplate.update({
      where: { id: userTemplate.id },
      data: {
        isPromoted: true,
      },
    });

    this.auditEventEmitter.emit({
      eventType: 'user_templates.promoted',
      category: 'templates',
      actorUserId: userId,
      entityType: 'template',
      entityId: promoted.id,
      metadata: {
        sourceUserTemplateId: userTemplate.id,
        slug: promoted.slug,
      },
    });

    return this.toTemplateRecord(promoted);
  }

  private toTemplateRecord(template: {
    id: string;
    slug: string;
    name: string;
    description: string | null;
    category: string;
    workType: string;
    isActive: boolean;
    version: number;
    usageCount: number;
    templateParameters: Prisma.JsonValue;
    createdAt: Date;
    updatedAt: Date;
  }): TemplateRecord {
    return {
      id: template.id,
      slug: template.slug,
      name: template.name,
      description: template.description,
      category: template.category,
      workType: template.workType,
      isActive: template.isActive,
      version: template.version,
      usageCount: template.usageCount,
      templateParameters: this.toTemplateParameters(template.templateParameters),
      createdAt: template.createdAt.toISOString(),
      updatedAt: template.updatedAt.toISOString(),
    };
  }

  private toUserTemplateRecord(template: {
    id: string;
    userId: string;
    baseTemplateId: string | null;
    name: string;
    description: string | null;
    isArchived: boolean;
    isPromoted: boolean;
    usageCount: number;
    templateParameters: Prisma.JsonValue;
    createdAt: Date;
    updatedAt: Date;
  }): UserTemplateRecord {
    return {
      id: template.id,
      userId: template.userId,
      baseTemplateId: template.baseTemplateId,
      name: template.name,
      description: template.description,
      isArchived: template.isArchived,
      isPromoted: template.isPromoted,
      usageCount: template.usageCount,
      templateParameters: this.toTemplateParameters(template.templateParameters),
      createdAt: template.createdAt.toISOString(),
      updatedAt: template.updatedAt.toISOString(),
    };
  }

  private toTemplateParameters(value: Prisma.JsonValue): TemplateParameterSet {
    return value as unknown as TemplateParameterSet;
  }

  private toWorkTypeSettingRecord(record: {
    id: string;
    slug: string;
    label: string;
    isActive: boolean;
    requiredFixedPages: Prisma.JsonValue;
    optionalFixedPages: Prisma.JsonValue;
    createdAt: Date;
    updatedAt: Date;
  }): WorkTypeSettingRecord {
    return {
      id: record.id,
      slug: record.slug,
      label: record.label,
      isActive: record.isActive,
      requiredFixedPages: this.toStringArray(record.requiredFixedPages),
      optionalFixedPages: this.toStringArray(record.optionalFixedPages),
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString(),
    };
  }

  private toStringArray(value: Prisma.JsonValue): string[] {
    return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string') : [];
  }
}
