import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type {
  AnalysisAddOnRecord,
  AnalysisCategoryRecord,
  ExpertProfileRecord,
  NdaAgreementRecord,
  AnalysisTicketFileRecord,
  AnalysisTicketRecord,
  TicketMessageRecord,
} from '@formatedit/shared';
import { randomUUID } from 'node:crypto';
import { basename } from 'node:path';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma.service';
import { AuditEventEmitterService } from '../audit/audit-event-emitter.service';
import { StorageService } from '../storage/storage.service';
import type {
  AnalysisAddOnUpsertInput,
  CreateTicketNdaInput,
  AnalysisCategoryUpsertInput,
  AnalysisTicketCreateInput,
  RateTicketInput,
  RequestRevisionInput,
  SendTicketMessageInput,
  SubmitQuoteInput,
  TicketListFilter,
} from './analysis.types';

@Injectable()
export class AnalysisService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly storageService: StorageService,
    private readonly auditEventEmitter: AuditEventEmitterService,
  ) {}

  async adminListCategories(): Promise<AnalysisCategoryRecord[]> {
    const categories = await this.prismaService.analysisCategory.findMany({
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });

    return categories.map((category) => this.toAnalysisCategoryRecord(category));
  }

  async adminCreateCategory(
    actorUserId: string,
    input: AnalysisCategoryUpsertInput,
  ): Promise<AnalysisCategoryRecord> {
    const existing = await this.prismaService.analysisCategory.findUnique({
      where: { slug: input.slug },
    });

    if (existing) {
      throw new ConflictException('Analysis category slug is already in use');
    }

    const created = await this.prismaService.analysisCategory.create({
      data: {
        slug: input.slug,
        name: input.name,
        description: input.description ?? null,
        isActive: input.isActive ?? true,
        sortOrder: input.sortOrder ?? 0,
      },
    });

    this.auditEventEmitter.emit({
      eventType: 'analysis_categories.created',
      category: 'analysis',
      actorUserId,
      entityType: 'analysis_category',
      entityId: created.id,
      metadata: { slug: created.slug },
    });

    return this.toAnalysisCategoryRecord(created);
  }

  async adminUpdateCategory(
    actorUserId: string,
    categoryId: string,
    input: AnalysisCategoryUpsertInput,
  ): Promise<AnalysisCategoryRecord> {
    const existing = await this.prismaService.analysisCategory.findUnique({
      where: { id: categoryId },
    });

    if (!existing) {
      throw new NotFoundException('Analysis category was not found');
    }

    const slugOwner = await this.prismaService.analysisCategory.findFirst({
      where: {
        slug: input.slug,
        NOT: { id: categoryId },
      },
    });

    if (slugOwner) {
      throw new ConflictException('Analysis category slug is already in use');
    }

    const updated = await this.prismaService.analysisCategory.update({
      where: { id: categoryId },
      data: {
        slug: input.slug,
        name: input.name,
        description: input.description ?? null,
        isActive: input.isActive ?? existing.isActive,
        sortOrder: input.sortOrder ?? existing.sortOrder,
      },
    });

    this.auditEventEmitter.emit({
      eventType: 'analysis_categories.updated',
      category: 'analysis',
      actorUserId,
      entityType: 'analysis_category',
      entityId: updated.id,
      metadata: { slug: updated.slug },
    });

    return this.toAnalysisCategoryRecord(updated);
  }

  async adminDeleteCategory(actorUserId: string, categoryId: string): Promise<{ success: true }> {
    const existing = await this.prismaService.analysisCategory.findUnique({
      where: { id: categoryId },
    });

    if (!existing) {
      throw new NotFoundException('Analysis category was not found');
    }

    await this.prismaService.analysisCategory.delete({
      where: { id: categoryId },
    });

    this.auditEventEmitter.emit({
      eventType: 'analysis_categories.deleted',
      category: 'analysis',
      actorUserId,
      entityType: 'analysis_category',
      entityId: categoryId,
      metadata: { slug: existing.slug },
    });

    return { success: true };
  }

  async adminListAddOns(): Promise<AnalysisAddOnRecord[]> {
    const addOns = await this.prismaService.analysisAddOn.findMany({
      orderBy: [{ name: 'asc' }],
    });

    return addOns.map((addOn) => this.toAnalysisAddOnRecord(addOn));
  }

  async adminCreateAddOn(
    actorUserId: string,
    input: AnalysisAddOnUpsertInput,
  ): Promise<AnalysisAddOnRecord> {
    const existing = await this.prismaService.analysisAddOn.findUnique({
      where: { slug: input.slug },
    });

    if (existing) {
      throw new ConflictException('Analysis add-on slug is already in use');
    }

    const created = await this.prismaService.analysisAddOn.create({
      data: {
        slug: input.slug,
        name: input.name,
        description: input.description ?? null,
        priceCents: input.priceCents,
        isActive: input.isActive ?? true,
      },
    });

    this.auditEventEmitter.emit({
      eventType: 'analysis_add_ons.created',
      category: 'analysis',
      actorUserId,
      entityType: 'analysis_add_on',
      entityId: created.id,
      metadata: { slug: created.slug, priceCents: created.priceCents },
    });

    return this.toAnalysisAddOnRecord(created);
  }

  async adminUpdateAddOn(
    actorUserId: string,
    addOnId: string,
    input: AnalysisAddOnUpsertInput,
  ): Promise<AnalysisAddOnRecord> {
    const existing = await this.prismaService.analysisAddOn.findUnique({
      where: { id: addOnId },
    });

    if (!existing) {
      throw new NotFoundException('Analysis add-on was not found');
    }

    const slugOwner = await this.prismaService.analysisAddOn.findFirst({
      where: {
        slug: input.slug,
        NOT: { id: addOnId },
      },
    });

    if (slugOwner) {
      throw new ConflictException('Analysis add-on slug is already in use');
    }

    const updated = await this.prismaService.analysisAddOn.update({
      where: { id: addOnId },
      data: {
        slug: input.slug,
        name: input.name,
        description: input.description ?? null,
        priceCents: input.priceCents,
        isActive: input.isActive ?? existing.isActive,
      },
    });

    this.auditEventEmitter.emit({
      eventType: 'analysis_add_ons.updated',
      category: 'analysis',
      actorUserId,
      entityType: 'analysis_add_on',
      entityId: updated.id,
      metadata: { slug: updated.slug, priceCents: updated.priceCents },
    });

    return this.toAnalysisAddOnRecord(updated);
  }

  async adminDeleteAddOn(actorUserId: string, addOnId: string): Promise<{ success: true }> {
    const existing = await this.prismaService.analysisAddOn.findUnique({
      where: { id: addOnId },
    });

    if (!existing) {
      throw new NotFoundException('Analysis add-on was not found');
    }

    await this.prismaService.analysisAddOn.delete({
      where: { id: addOnId },
    });

    this.auditEventEmitter.emit({
      eventType: 'analysis_add_ons.deleted',
      category: 'analysis',
      actorUserId,
      entityType: 'analysis_add_on',
      entityId: addOnId,
      metadata: { slug: existing.slug, priceCents: existing.priceCents },
    });

    return { success: true };
  }

  async createTicket(
    customerUserId: string,
    input: AnalysisTicketCreateInput,
  ): Promise<AnalysisTicketRecord> {
    const category = await this.prismaService.analysisCategory.findUnique({
      where: { slug: input.categorySlug },
    });

    if (!category || !category.isActive) {
      throw new NotFoundException('Analysis category was not found');
    }

    const created = await this.prismaService.analysisTicket.create({
      data: {
        ticketNumber: this.generateTicketNumber(),
        customerUserId,
        categorySlug: category.slug,
        categoryNameSnapshot: category.name,
        title: input.title,
        brief: input.brief,
        deliveryMode: input.deliveryMode ?? 'STANDARD',
        status: 'OPEN',
      },
    });

    const assignment = await this.findAutoAssignmentCandidate(category.slug);
    let finalTicket = created;

    if (assignment) {
      finalTicket = await this.prismaService.analysisTicket.update({
        where: { id: created.id },
        data: {
          assignedExpertUserId: assignment.userId,
          status: 'ASSIGNED',
          assignedAt: new Date(),
        },
      });

      await this.prismaService.expertProfile.update({
        where: { id: assignment.id },
        data: {
          activeTickets: assignment.activeTickets + 1,
        },
      });

      this.auditEventEmitter.emit({
        eventType: 'analysis_tickets.auto_assigned',
        category: 'analysis',
        actorUserId: customerUserId,
        entityType: 'analysis_ticket',
        entityId: created.id,
        metadata: {
          assignedExpertUserId: assignment.userId,
          expertProfileId: assignment.id,
          categorySlug: category.slug,
        },
      });
    }

    this.auditEventEmitter.emit({
      eventType: 'analysis_tickets.created',
      category: 'analysis',
      actorUserId: customerUserId,
      entityType: 'analysis_ticket',
      entityId: created.id,
      metadata: {
        ticketNumber: created.ticketNumber,
        categorySlug: created.categorySlug,
        deliveryMode: created.deliveryMode,
        assignedExpertUserId: finalTicket.assignedExpertUserId ?? null,
      },
    });

    return this.toAnalysisTicketRecord(finalTicket);
  }

  async uploadTicketFile(
    actorUserId: string,
    ticketId: string,
    fileType: 'DATA' | 'DESCRIPTION' | 'SAMPLE',
    file: Express.Multer.File | undefined,
  ): Promise<AnalysisTicketFileRecord> {
    if (!file) {
      throw new BadRequestException('Upload file was not provided');
    }

    const ticket = await this.prismaService.analysisTicket.findUnique({
      where: { id: ticketId },
    });

    if (!ticket || ticket.customerUserId !== actorUserId) {
      throw new NotFoundException('Analysis ticket was not found');
    }

    const storageKey = this.buildTicketFileStorageKey(ticket.id, fileType, file.originalname);
    await this.storageService.uploadObject({
      key: storageKey,
      body: file.buffer,
      contentType: file.mimetype,
    });

    const created = await this.prismaService.ticketFile.create({
      data: {
        ticketId: ticket.id,
        uploadedByUserId: actorUserId,
        fileType,
        storageKey,
        originalFileName: file.originalname,
        mimeType: file.mimetype,
        sizeBytes: file.size,
      },
    });

    this.auditEventEmitter.emit({
      eventType: 'analysis_ticket_files.uploaded',
      category: 'analysis',
      actorUserId,
      entityType: 'ticket_file',
      entityId: created.id,
      metadata: {
        ticketId: ticket.id,
        fileType,
        storageKey,
      },
    });

    return this.toAnalysisTicketFileRecord(created);
  }

  async adminCreateTicketNda(
    actorUserId: string,
    ticketId: string,
    input: CreateTicketNdaInput,
  ): Promise<NdaAgreementRecord> {
    const ticket = await this.prismaService.analysisTicket.findUnique({
      where: { id: ticketId },
    });

    if (!ticket) {
      throw new NotFoundException('Analysis ticket was not found');
    }

    if (ticket.assignedExpertUserId !== input.expertUserId) {
      throw new BadRequestException('NDA can only be opened for the assigned expert');
    }

    const agreement = await this.prismaService.ndaAgreement.upsert({
      where: { ticketId },
      create: {
        ticketId,
        expertUserId: input.expertUserId,
        documentStorageKey: input.documentStorageKey ?? null,
      },
      update: {
        expertUserId: input.expertUserId,
        documentStorageKey: input.documentStorageKey ?? null,
        agreedAt: null,
      },
    });

    this.auditEventEmitter.emit({
      eventType: 'analysis_tickets.nda_requested',
      category: 'analysis',
      actorUserId,
      entityType: 'nda_agreement',
      entityId: agreement.id,
      metadata: {
        ticketId,
        expertUserId: input.expertUserId,
        documentStorageKey: agreement.documentStorageKey,
      },
    });

    return this.toNdaAgreementRecord(agreement);
  }

  // ───────── T228: Ticket listing (customer + expert + admin) ─────────

  async listCustomerTickets(
    customerUserId: string,
    filter: TicketListFilter,
  ): Promise<{ items: AnalysisTicketRecord[]; total: number }> {
    const page = filter.page ?? 1;
    const limit = Math.min(filter.limit ?? 20, 100);
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = { customerUserId };
    if (filter.status) where.status = filter.status;
    if (filter.categorySlug) where.categorySlug = filter.categorySlug;
    if (filter.deliveryMode) where.deliveryMode = filter.deliveryMode;

    const [items, total] = await Promise.all([
      this.prismaService.analysisTicket.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prismaService.analysisTicket.count({ where }),
    ]);

    return {
      items: items.map((ticket) => this.toAnalysisTicketRecord(ticket)),
      total,
    };
  }

  async listExpertTickets(
    expertUserId: string,
    filter: TicketListFilter,
  ): Promise<{ items: AnalysisTicketRecord[]; total: number }> {
    const page = filter.page ?? 1;
    const limit = Math.min(filter.limit ?? 20, 100);
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = { assignedExpertUserId: expertUserId };
    if (filter.status) where.status = filter.status;

    const [items, total] = await Promise.all([
      this.prismaService.analysisTicket.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prismaService.analysisTicket.count({ where }),
    ]);

    return {
      items: items.map((ticket) => this.toAnalysisTicketRecord(ticket)),
      total,
    };
  }

  async adminListTickets(
    filter: TicketListFilter,
  ): Promise<{ items: AnalysisTicketRecord[]; total: number }> {
    const page = filter.page ?? 1;
    const limit = Math.min(filter.limit ?? 20, 100);
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};
    if (filter.status) where.status = filter.status;
    if (filter.categorySlug) where.categorySlug = filter.categorySlug;
    if (filter.deliveryMode) where.deliveryMode = filter.deliveryMode;

    const [items, total] = await Promise.all([
      this.prismaService.analysisTicket.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prismaService.analysisTicket.count({ where }),
    ]);

    return {
      items: items.map((ticket) => this.toAnalysisTicketRecord(ticket)),
      total,
    };
  }

  // ───────── T228: Ticket detail ─────────

  async getTicketDetail(
    actorUserId: string,
    ticketId: string,
    actorRole: 'CUSTOMER' | 'EXPERT' | 'ADMIN',
  ): Promise<AnalysisTicketRecord> {
    const ticket = await this.prismaService.analysisTicket.findUnique({
      where: { id: ticketId },
    });

    if (!ticket) {
      throw new NotFoundException('Analysis ticket was not found');
    }

    if (
      actorRole === 'CUSTOMER' &&
      ticket.customerUserId !== actorUserId
    ) {
      throw new NotFoundException('Analysis ticket was not found');
    }

    if (
      actorRole === 'EXPERT' &&
      ticket.assignedExpertUserId !== actorUserId
    ) {
      throw new NotFoundException('Analysis ticket was not found');
    }

    return this.toAnalysisTicketRecord(ticket);
  }

  async getTicketFiles(
    actorUserId: string,
    ticketId: string,
    actorRole: 'CUSTOMER' | 'EXPERT' | 'ADMIN',
  ): Promise<AnalysisTicketFileRecord[]> {
    const ticket = await this.prismaService.analysisTicket.findUnique({
      where: { id: ticketId },
    });

    if (!ticket) {
      throw new NotFoundException('Analysis ticket was not found');
    }

    if (actorRole === 'CUSTOMER' && ticket.customerUserId !== actorUserId) {
      throw new NotFoundException('Analysis ticket was not found');
    }

    if (actorRole === 'EXPERT' && ticket.assignedExpertUserId !== actorUserId) {
      throw new NotFoundException('Analysis ticket was not found');
    }

    const files = await this.prismaService.ticketFile.findMany({
      where: { ticketId },
      orderBy: { createdAt: 'asc' },
    });

    return files.map((file) => this.toAnalysisTicketFileRecord(file));
  }

  // ───────── T229: Expert submits quote ─────────

  async submitQuote(
    expertUserId: string,
    ticketId: string,
    input: SubmitQuoteInput,
  ): Promise<AnalysisTicketRecord> {
    const ticket = await this.prismaService.analysisTicket.findUnique({
      where: { id: ticketId },
    });

    if (!ticket || ticket.assignedExpertUserId !== expertUserId) {
      throw new NotFoundException('Analysis ticket was not found');
    }

    if (ticket.status !== 'ASSIGNED') {
      throw new BadRequestException('Ticket must be in ASSIGNED status to submit a quote');
    }

    const updated = await this.prismaService.analysisTicket.update({
      where: { id: ticketId },
      data: {
        quotePriceCents: input.priceCents,
        quoteNote: input.note ?? null,
        quotedAt: new Date(),
        deadlineAt: input.deadlineAt ? new Date(input.deadlineAt) : null,
        status: 'QUOTED',
        lastActivityAt: new Date(),
      },
    });

    this.auditEventEmitter.emit({
      eventType: 'analysis_tickets.quoted',
      category: 'analysis',
      actorUserId: expertUserId,
      entityType: 'analysis_ticket',
      entityId: ticketId,
      metadata: {
        priceCents: input.priceCents,
        deadlineAt: input.deadlineAt ?? null,
      },
    });

    return this.toAnalysisTicketRecord(updated);
  }

  // ───────── T230: Customer approves quote ─────────

  async approveQuote(
    customerUserId: string,
    ticketId: string,
  ): Promise<AnalysisTicketRecord> {
    const ticket = await this.prismaService.analysisTicket.findUnique({
      where: { id: ticketId },
    });

    if (!ticket || ticket.customerUserId !== customerUserId) {
      throw new NotFoundException('Analysis ticket was not found');
    }

    if (ticket.status !== 'QUOTED') {
      throw new BadRequestException('Ticket must be in QUOTED status to approve');
    }

    const updated = await this.prismaService.analysisTicket.update({
      where: { id: ticketId },
      data: {
        customerApprovedAt: new Date(),
        status: 'IN_PROGRESS',
        lastActivityAt: new Date(),
      },
    });

    this.auditEventEmitter.emit({
      eventType: 'analysis_tickets.approved',
      category: 'analysis',
      actorUserId: customerUserId,
      entityType: 'analysis_ticket',
      entityId: ticketId,
      metadata: {
        quotePriceCents: ticket.quotePriceCents,
      },
    });

    return this.toAnalysisTicketRecord(updated);
  }

  async rejectQuote(
    customerUserId: string,
    ticketId: string,
  ): Promise<AnalysisTicketRecord> {
    const ticket = await this.prismaService.analysisTicket.findUnique({
      where: { id: ticketId },
    });

    if (!ticket || ticket.customerUserId !== customerUserId) {
      throw new NotFoundException('Analysis ticket was not found');
    }

    if (ticket.status !== 'QUOTED') {
      throw new BadRequestException('Ticket must be in QUOTED status to reject');
    }

    const updated = await this.prismaService.analysisTicket.update({
      where: { id: ticketId },
      data: {
        status: 'ASSIGNED',
        quotePriceCents: null,
        quoteNote: null,
        quotedAt: null,
        deadlineAt: null,
        lastActivityAt: new Date(),
      },
    });

    this.auditEventEmitter.emit({
      eventType: 'analysis_tickets.quote_rejected',
      category: 'analysis',
      actorUserId: customerUserId,
      entityType: 'analysis_ticket',
      entityId: ticketId,
      metadata: {},
    });

    return this.toAnalysisTicketRecord(updated);
  }

  // ───────── T231: Revision request ─────────

  async requestRevision(
    customerUserId: string,
    ticketId: string,
    input: RequestRevisionInput,
  ): Promise<AnalysisTicketRecord> {
    const ticket = await this.prismaService.analysisTicket.findUnique({
      where: { id: ticketId },
    });

    if (!ticket || ticket.customerUserId !== customerUserId) {
      throw new NotFoundException('Analysis ticket was not found');
    }

    if (ticket.status !== 'DELIVERED') {
      throw new BadRequestException('Ticket must be in DELIVERED status to request revision');
    }

    if (ticket.revisionCount >= ticket.maxRevisions) {
      throw new BadRequestException(
        `Maximum revision count (${ticket.maxRevisions}) has been reached`,
      );
    }

    const updated = await this.prismaService.analysisTicket.update({
      where: { id: ticketId },
      data: {
        status: 'REVISION_REQUESTED',
        revisionCount: ticket.revisionCount + 1,
        lastActivityAt: new Date(),
      },
    });

    // Insert system message for the revision request
    await this.prismaService.ticketMessage.create({
      data: {
        ticketId,
        senderUserId: customerUserId,
        senderType: 'CUSTOMER',
        body: input.reason,
        metadata: { type: 'revision_request', revisionNumber: updated.revisionCount },
      },
    });

    this.auditEventEmitter.emit({
      eventType: 'analysis_tickets.revision_requested',
      category: 'analysis',
      actorUserId: customerUserId,
      entityType: 'analysis_ticket',
      entityId: ticketId,
      metadata: {
        revisionCount: updated.revisionCount,
        maxRevisions: updated.maxRevisions,
        reason: input.reason,
      },
    });

    return this.toAnalysisTicketRecord(updated);
  }

  // ───────── T232: Ticket messaging ─────────

  async sendMessage(
    actorUserId: string,
    ticketId: string,
    senderType: 'CUSTOMER' | 'EXPERT',
    input: SendTicketMessageInput,
  ): Promise<TicketMessageRecord> {
    const ticket = await this.prismaService.analysisTicket.findUnique({
      where: { id: ticketId },
    });

    if (!ticket) {
      throw new NotFoundException('Analysis ticket was not found');
    }

    if (senderType === 'CUSTOMER' && ticket.customerUserId !== actorUserId) {
      throw new NotFoundException('Analysis ticket was not found');
    }

    if (senderType === 'EXPERT' && ticket.assignedExpertUserId !== actorUserId) {
      throw new NotFoundException('Analysis ticket was not found');
    }

    const closedStatuses = ['CLOSED', 'CANCELLED'];
    if (closedStatuses.includes(ticket.status)) {
      throw new BadRequestException('Cannot send messages on a closed ticket');
    }

    const message = await this.prismaService.ticketMessage.create({
      data: {
        ticketId,
        senderUserId: actorUserId,
        senderType,
        body: input.body,
        metadata: (input.metadata as Prisma.InputJsonValue) ?? undefined,
      },
    });

    await this.prismaService.analysisTicket.update({
      where: { id: ticketId },
      data: { lastActivityAt: new Date() },
    });

    return this.toTicketMessageRecord(message);
  }

  async listMessages(
    actorUserId: string,
    ticketId: string,
    actorRole: 'CUSTOMER' | 'EXPERT' | 'ADMIN',
  ): Promise<TicketMessageRecord[]> {
    const ticket = await this.prismaService.analysisTicket.findUnique({
      where: { id: ticketId },
    });

    if (!ticket) {
      throw new NotFoundException('Analysis ticket was not found');
    }

    if (actorRole === 'CUSTOMER' && ticket.customerUserId !== actorUserId) {
      throw new NotFoundException('Analysis ticket was not found');
    }

    if (actorRole === 'EXPERT' && ticket.assignedExpertUserId !== actorUserId) {
      throw new NotFoundException('Analysis ticket was not found');
    }

    const messages = await this.prismaService.ticketMessage.findMany({
      where: { ticketId },
      orderBy: { createdAt: 'asc' },
    });

    return messages.map((m) => this.toTicketMessageRecord(m));
  }

  // ───────── T233: Status flow (expert marks delivered, admin force-status) ─────────

  async markDelivered(
    expertUserId: string,
    ticketId: string,
  ): Promise<AnalysisTicketRecord> {
    const ticket = await this.prismaService.analysisTicket.findUnique({
      where: { id: ticketId },
    });

    if (!ticket || ticket.assignedExpertUserId !== expertUserId) {
      throw new NotFoundException('Analysis ticket was not found');
    }

    const allowedStatuses = ['IN_PROGRESS', 'REVISION_REQUESTED'];
    if (!allowedStatuses.includes(ticket.status)) {
      throw new BadRequestException('Ticket must be IN_PROGRESS or REVISION_REQUESTED to deliver');
    }

    const updated = await this.prismaService.analysisTicket.update({
      where: { id: ticketId },
      data: {
        status: 'DELIVERED',
        lastActivityAt: new Date(),
      },
    });

    await this.prismaService.ticketMessage.create({
      data: {
        ticketId,
        senderType: 'SYSTEM',
        body: 'Expert has marked this ticket as delivered.',
        metadata: { type: 'status_change', newStatus: 'DELIVERED' },
      },
    });

    this.auditEventEmitter.emit({
      eventType: 'analysis_tickets.delivered',
      category: 'analysis',
      actorUserId: expertUserId,
      entityType: 'analysis_ticket',
      entityId: ticketId,
      metadata: {},
    });

    return this.toAnalysisTicketRecord(updated);
  }

  async adminForceStatus(
    actorUserId: string,
    ticketId: string,
    newStatus: string,
  ): Promise<AnalysisTicketRecord> {
    const ticket = await this.prismaService.analysisTicket.findUnique({
      where: { id: ticketId },
    });

    if (!ticket) {
      throw new NotFoundException('Analysis ticket was not found');
    }

    const validStatuses = [
      'OPEN', 'ASSIGNED', 'QUOTED', 'AWAITING_PAYMENT',
      'IN_PROGRESS', 'DELIVERED', 'REVISION_REQUESTED', 'CLOSED', 'CANCELLED',
    ];

    if (!validStatuses.includes(newStatus)) {
      throw new BadRequestException(`Invalid status: ${newStatus}`);
    }

    const data: Record<string, unknown> = {
      status: newStatus,
      lastActivityAt: new Date(),
    };

    if (newStatus === 'CLOSED' || newStatus === 'CANCELLED') {
      data.closedAt = new Date();
    }

    const updated = await this.prismaService.analysisTicket.update({
      where: { id: ticketId },
      data,
    });

    await this.prismaService.ticketMessage.create({
      data: {
        ticketId,
        senderType: 'SYSTEM',
        body: `Admin changed ticket status to ${newStatus}.`,
        metadata: { type: 'admin_status_change', newStatus, oldStatus: ticket.status },
      },
    });

    this.auditEventEmitter.emit({
      eventType: 'analysis_tickets.admin_status_changed',
      category: 'analysis',
      actorUserId,
      entityType: 'analysis_ticket',
      entityId: ticketId,
      metadata: { oldStatus: ticket.status, newStatus },
    });

    return this.toAnalysisTicketRecord(updated);
  }

  // ───────── T234: Express delivery upgrade ─────────

  async upgradeToExpress(
    customerUserId: string,
    ticketId: string,
  ): Promise<AnalysisTicketRecord> {
    const ticket = await this.prismaService.analysisTicket.findUnique({
      where: { id: ticketId },
    });

    if (!ticket || ticket.customerUserId !== customerUserId) {
      throw new NotFoundException('Analysis ticket was not found');
    }

    if (ticket.deliveryMode === 'EXPRESS') {
      throw new BadRequestException('Ticket is already set to express delivery');
    }

    const nonUpgradeableStatuses = ['DELIVERED', 'CLOSED', 'CANCELLED'];
    if (nonUpgradeableStatuses.includes(ticket.status)) {
      throw new BadRequestException('Cannot upgrade delivery mode at this stage');
    }

    const updated = await this.prismaService.analysisTicket.update({
      where: { id: ticketId },
      data: {
        deliveryMode: 'EXPRESS',
        lastActivityAt: new Date(),
      },
    });

    this.auditEventEmitter.emit({
      eventType: 'analysis_tickets.express_upgraded',
      category: 'analysis',
      actorUserId: customerUserId,
      entityType: 'analysis_ticket',
      entityId: ticketId,
      metadata: {},
    });

    return this.toAnalysisTicketRecord(updated);
  }

  // ───────── T236: Expert profile management ─────────

  async getExpertProfile(userId: string): Promise<ExpertProfileRecord | null> {
    const profile = await this.prismaService.expertProfile.findUnique({
      where: { userId },
    });

    return profile ? this.toExpertProfileRecord(profile) : null;
  }

  async adminListExperts(): Promise<ExpertProfileRecord[]> {
    const profiles = await this.prismaService.expertProfile.findMany({
      orderBy: { createdAt: 'asc' },
    });

    return profiles.map((p) => this.toExpertProfileRecord(p));
  }

  // ───────── T237: Expert uploads result file ─────────

  async uploadResultFile(
    expertUserId: string,
    ticketId: string,
    file: Express.Multer.File | undefined,
  ): Promise<AnalysisTicketFileRecord> {
    if (!file) {
      throw new BadRequestException('Upload file was not provided');
    }

    const ticket = await this.prismaService.analysisTicket.findUnique({
      where: { id: ticketId },
    });

    if (!ticket || ticket.assignedExpertUserId !== expertUserId) {
      throw new NotFoundException('Analysis ticket was not found');
    }

    const allowedStatuses = ['IN_PROGRESS', 'REVISION_REQUESTED'];
    if (!allowedStatuses.includes(ticket.status)) {
      throw new BadRequestException('Result files can only be uploaded for in-progress tickets');
    }

    const safeFileName = basename(file.originalname).replaceAll(/\s+/g, '-');
    const storageKey = `analysis-tickets/${ticketId}/result/${randomUUID()}-${safeFileName}`;

    await this.storageService.uploadObject({
      key: storageKey,
      body: file.buffer,
      contentType: file.mimetype,
    });

    const created = await this.prismaService.ticketFile.create({
      data: {
        ticketId,
        uploadedByUserId: expertUserId,
        fileType: 'RESULT',
        storageKey,
        originalFileName: file.originalname,
        mimeType: file.mimetype,
        sizeBytes: file.size,
      },
    });

    this.auditEventEmitter.emit({
      eventType: 'analysis_ticket_files.result_uploaded',
      category: 'analysis',
      actorUserId: expertUserId,
      entityType: 'ticket_file',
      entityId: created.id,
      metadata: { ticketId, storageKey },
    });

    return this.toAnalysisTicketFileRecord(created);
  }

  // ───────── T238: Customer rates completed ticket ─────────

  async rateTicket(
    customerUserId: string,
    ticketId: string,
    input: RateTicketInput,
  ): Promise<AnalysisTicketRecord> {
    const ticket = await this.prismaService.analysisTicket.findUnique({
      where: { id: ticketId },
    });

    if (!ticket || ticket.customerUserId !== customerUserId) {
      throw new NotFoundException('Analysis ticket was not found');
    }

    if (ticket.status !== 'DELIVERED' && ticket.status !== 'CLOSED') {
      throw new BadRequestException('Ticket must be DELIVERED or CLOSED to rate');
    }

    if (ticket.ratedAt) {
      throw new BadRequestException('Ticket has already been rated');
    }

    const updated = await this.prismaService.analysisTicket.update({
      where: { id: ticketId },
      data: {
        rating: input.rating,
        ratingComment: input.comment ?? null,
        ratedAt: new Date(),
        lastActivityAt: new Date(),
      },
    });

    // Update expert's average rating
    if (ticket.assignedExpertUserId) {
      await this.recalculateExpertRating(ticket.assignedExpertUserId);
    }

    this.auditEventEmitter.emit({
      eventType: 'analysis_tickets.rated',
      category: 'analysis',
      actorUserId: customerUserId,
      entityType: 'analysis_ticket',
      entityId: ticketId,
      metadata: { rating: input.rating },
    });

    return this.toAnalysisTicketRecord(updated);
  }

  // ───────── T239: Close ticket ─────────

  async closeTicket(
    customerUserId: string,
    ticketId: string,
  ): Promise<AnalysisTicketRecord> {
    const ticket = await this.prismaService.analysisTicket.findUnique({
      where: { id: ticketId },
    });

    if (!ticket || ticket.customerUserId !== customerUserId) {
      throw new NotFoundException('Analysis ticket was not found');
    }

    if (ticket.status !== 'DELIVERED') {
      throw new BadRequestException('Ticket must be in DELIVERED status to close');
    }

    const updated = await this.prismaService.analysisTicket.update({
      where: { id: ticketId },
      data: {
        status: 'CLOSED',
        closedAt: new Date(),
        lastActivityAt: new Date(),
      },
    });

    // Decrement expert active ticket count
    if (ticket.assignedExpertUserId) {
      const expertProfile = await this.prismaService.expertProfile.findUnique({
        where: { userId: ticket.assignedExpertUserId },
      });

      if (expertProfile) {
        await this.prismaService.expertProfile.update({
          where: { id: expertProfile.id },
          data: {
            activeTickets: Math.max(0, expertProfile.activeTickets - 1),
            totalCompleted: expertProfile.totalCompleted + 1,
          },
        });
      }
    }

    this.auditEventEmitter.emit({
      eventType: 'analysis_tickets.closed',
      category: 'analysis',
      actorUserId: customerUserId,
      entityType: 'analysis_ticket',
      entityId: ticketId,
      metadata: {},
    });

    return this.toAnalysisTicketRecord(updated);
  }

  async cancelTicket(
    actorUserId: string,
    ticketId: string,
  ): Promise<AnalysisTicketRecord> {
    const ticket = await this.prismaService.analysisTicket.findUnique({
      where: { id: ticketId },
    });

    if (!ticket || ticket.customerUserId !== actorUserId) {
      throw new NotFoundException('Analysis ticket was not found');
    }

    const cancellableStatuses = ['OPEN', 'ASSIGNED', 'QUOTED'];
    if (!cancellableStatuses.includes(ticket.status)) {
      throw new BadRequestException('Ticket can only be cancelled before work begins');
    }

    const updated = await this.prismaService.analysisTicket.update({
      where: { id: ticketId },
      data: {
        status: 'CANCELLED',
        closedAt: new Date(),
        lastActivityAt: new Date(),
      },
    });

    // Decrement expert active ticket count if was assigned
    if (ticket.assignedExpertUserId) {
      const expertProfile = await this.prismaService.expertProfile.findUnique({
        where: { userId: ticket.assignedExpertUserId },
      });

      if (expertProfile) {
        await this.prismaService.expertProfile.update({
          where: { id: expertProfile.id },
          data: {
            activeTickets: Math.max(0, expertProfile.activeTickets - 1),
          },
        });
      }
    }

    this.auditEventEmitter.emit({
      eventType: 'analysis_tickets.cancelled',
      category: 'analysis',
      actorUserId,
      entityType: 'analysis_ticket',
      entityId: ticketId,
      metadata: {},
    });

    return this.toAnalysisTicketRecord(updated);
  }

  async agreeToTicketNda(actorUserId: string, ticketId: string): Promise<NdaAgreementRecord> {
    const agreement = await this.prismaService.ndaAgreement.findUnique({
      where: { ticketId },
    });

    if (!agreement || agreement.expertUserId !== actorUserId) {
      throw new NotFoundException('Ticket NDA was not found');
    }

    const updated = await this.prismaService.ndaAgreement.update({
      where: { id: agreement.id },
      data: {
        agreedAt: new Date(),
      },
    });

    this.auditEventEmitter.emit({
      eventType: 'analysis_tickets.nda_agreed',
      category: 'analysis',
      actorUserId,
      entityType: 'nda_agreement',
      entityId: updated.id,
      metadata: {
        ticketId,
      },
    });

    return this.toNdaAgreementRecord(updated);
  }

  private toAnalysisCategoryRecord(category: {
    id: string;
    slug: string;
    name: string;
    description: string | null;
    isActive: boolean;
    sortOrder: number;
    createdAt: Date;
    updatedAt: Date;
  }): AnalysisCategoryRecord {
    return {
      id: category.id,
      slug: category.slug,
      name: category.name,
      description: category.description,
      isActive: category.isActive,
      sortOrder: category.sortOrder,
      createdAt: category.createdAt.toISOString(),
      updatedAt: category.updatedAt.toISOString(),
    };
  }

  private toAnalysisAddOnRecord(addOn: {
    id: string;
    slug: string;
    name: string;
    description: string | null;
    priceCents: number;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
  }): AnalysisAddOnRecord {
    return {
      id: addOn.id,
      slug: addOn.slug,
      name: addOn.name,
      description: addOn.description,
      priceCents: addOn.priceCents,
      isActive: addOn.isActive,
      createdAt: addOn.createdAt.toISOString(),
      updatedAt: addOn.updatedAt.toISOString(),
    };
  }

  private toAnalysisTicketRecord(ticket: {
    id: string;
    ticketNumber: string;
    customerUserId: string;
    assignedExpertUserId: string | null;
    categorySlug: string;
    categoryNameSnapshot: string;
    title: string;
    brief: string;
    status:
      | 'OPEN'
      | 'ASSIGNED'
      | 'QUOTED'
      | 'AWAITING_PAYMENT'
      | 'IN_PROGRESS'
      | 'DELIVERED'
      | 'REVISION_REQUESTED'
      | 'CLOSED'
      | 'CANCELLED';
    deliveryMode: 'STANDARD' | 'EXPRESS';
    quotePriceCents: number | null;
    quoteNote: string | null;
    quotedAt: Date | null;
    customerApprovedAt: Date | null;
    revisionCount: number;
    maxRevisions: number;
    rating: number | null;
    ratingComment: string | null;
    ratedAt: Date | null;
    deadlineAt: Date | null;
    assignedAt: Date | null;
    closedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  }): AnalysisTicketRecord {
    return {
      id: ticket.id,
      ticketNumber: ticket.ticketNumber,
      customerUserId: ticket.customerUserId,
      assignedExpertUserId: ticket.assignedExpertUserId,
      categorySlug: ticket.categorySlug,
      categoryNameSnapshot: ticket.categoryNameSnapshot,
      title: ticket.title,
      brief: ticket.brief,
      status: ticket.status,
      deliveryMode: ticket.deliveryMode,
      quotePriceCents: ticket.quotePriceCents,
      quoteNote: ticket.quoteNote,
      quotedAt: ticket.quotedAt?.toISOString() ?? null,
      customerApprovedAt: ticket.customerApprovedAt?.toISOString() ?? null,
      revisionCount: ticket.revisionCount,
      maxRevisions: ticket.maxRevisions,
      rating: ticket.rating,
      ratingComment: ticket.ratingComment,
      ratedAt: ticket.ratedAt?.toISOString() ?? null,
      deadlineAt: ticket.deadlineAt?.toISOString() ?? null,
      assignedAt: ticket.assignedAt?.toISOString() ?? null,
      closedAt: ticket.closedAt?.toISOString() ?? null,
      createdAt: ticket.createdAt.toISOString(),
      updatedAt: ticket.updatedAt.toISOString(),
    };
  }

  private toTicketMessageRecord(message: {
    id: string;
    ticketId: string;
    senderUserId: string | null;
    senderType: 'CUSTOMER' | 'EXPERT' | 'SYSTEM';
    body: string;
    metadata: unknown;
    createdAt: Date;
  }): TicketMessageRecord {
    return {
      id: message.id,
      ticketId: message.ticketId,
      senderUserId: message.senderUserId,
      senderType: message.senderType,
      body: message.body,
      metadata: (message.metadata as Record<string, unknown>) ?? null,
      createdAt: message.createdAt.toISOString(),
    };
  }

  private toExpertProfileRecord(profile: {
    id: string;
    userId: string;
    bio: string | null;
    maxConcurrent: number;
    activeTickets: number;
    isAvailable: boolean;
    averageRating: number | null;
    totalCompleted: number;
    createdAt: Date;
    updatedAt: Date;
  }): ExpertProfileRecord {
    return {
      id: profile.id,
      userId: profile.userId,
      bio: profile.bio,
      maxConcurrent: profile.maxConcurrent,
      activeTickets: profile.activeTickets,
      isAvailable: profile.isAvailable,
      averageRating: profile.averageRating,
      totalCompleted: profile.totalCompleted,
      createdAt: profile.createdAt.toISOString(),
      updatedAt: profile.updatedAt.toISOString(),
    };
  }

  private toAnalysisTicketFileRecord(file: {
    id: string;
    ticketId: string;
    uploadedByUserId: string;
    fileType: 'DATA' | 'DESCRIPTION' | 'SAMPLE' | 'RESULT';
    storageKey: string;
    originalFileName: string;
    mimeType: string;
    sizeBytes: number;
    createdAt: Date;
  }): AnalysisTicketFileRecord {
    return {
      id: file.id,
      ticketId: file.ticketId,
      uploadedByUserId: file.uploadedByUserId,
      fileType: file.fileType,
      storageKey: file.storageKey,
      originalFileName: file.originalFileName,
      mimeType: file.mimeType,
      sizeBytes: file.sizeBytes,
      createdAt: file.createdAt.toISOString(),
    };
  }

  private toNdaAgreementRecord(agreement: {
    id: string;
    ticketId: string;
    expertUserId: string;
    agreedAt: Date | null;
    documentStorageKey: string | null;
    createdAt: Date;
  }): NdaAgreementRecord {
    return {
      id: agreement.id,
      ticketId: agreement.ticketId,
      expertUserId: agreement.expertUserId,
      agreedAt: agreement.agreedAt ? agreement.agreedAt.toISOString() : null,
      documentStorageKey: agreement.documentStorageKey,
      createdAt: agreement.createdAt.toISOString(),
    };
  }

  private generateTicketNumber(): string {
    const datePart = new Date().toISOString().slice(0, 10).replaceAll('-', '');
    const suffix = randomUUID().slice(0, 8).toUpperCase();
    return `ANL-${datePart}-${suffix}`;
  }

  private buildTicketFileStorageKey(
    ticketId: string,
    fileType: 'DATA' | 'DESCRIPTION' | 'SAMPLE',
    originalFileName: string,
  ): string {
    const safeFileName = basename(originalFileName).replaceAll(/\s+/g, '-');
    return `analysis-tickets/${ticketId}/${fileType.toLowerCase()}/${randomUUID()}-${safeFileName}`;
  }

  private async recalculateExpertRating(expertUserId: string): Promise<void> {
    const result = await this.prismaService.analysisTicket.aggregate({
      where: {
        assignedExpertUserId: expertUserId,
        ratedAt: { not: null },
        rating: { not: null },
      },
      _avg: { rating: true },
    });

    if (result._avg.rating !== null) {
      await this.prismaService.expertProfile.updateMany({
        where: { userId: expertUserId },
        data: {
          averageRating: Math.round(result._avg.rating * 100) / 100,
        },
      });
    }
  }

  private async findAutoAssignmentCandidate(categorySlug: string): Promise<{
    id: string;
    userId: string;
    activeTickets: number;
    totalCompleted: number;
    createdAt: Date;
  } | null> {
    const profiles = (await this.prismaService.expertProfile.findMany({
      where: { isAvailable: true },
    })) as unknown as Array<{
      id: string;
      userId: string;
      maxConcurrent: number;
      activeTickets: number;
      totalCompleted: number;
      createdAt: Date;
      tags: Array<{ categorySlug: string }>;
    }>;

    const eligible = profiles
      .filter((profile) => profile.activeTickets < profile.maxConcurrent)
      .filter((profile) => profile.tags.some((tag) => tag.categorySlug === categorySlug))
      .sort((left, right) => {
        if (left.activeTickets !== right.activeTickets) {
          return left.activeTickets - right.activeTickets;
        }

        if (left.totalCompleted !== right.totalCompleted) {
          return right.totalCompleted - left.totalCompleted;
        }

        return left.createdAt.getTime() - right.createdAt.getTime();
      });

    return eligible[0] ?? null;
  }
}
