import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'node:crypto';
import type {
  StudentVerificationRecord,
  StudentVerificationStatusValue,
} from '@formatedit/shared';
import { AuditEventEmitterService } from '../audit/audit-event-emitter.service';
import { PrismaService } from '../../prisma.service';
import type { InitiateStudentVerificationInput } from './schemas/initiate-verification.schema';

interface SheerIdVerificationStatus {
  currentStep?: string;
  segment?: string;
  errorIds?: string[];
  rewardCode?: string;
  estimatedCompletionTime?: string;
}

interface SheerIdWebhookPayload {
  verificationId: string;
  currentStep?: string;
  errorIds?: string[];
  metadata?: Record<string, unknown>;
}

const STEP_VERIFIED = ['success', 'rewardDelivery', 'collectFeedback'];
const STEP_REJECTED = ['error', 'docReviewRejected'];

/**
 * Task 249: SheerID-backed student verification.
 *
 * Flow:
 *   1. `initiateForUser` creates a PENDING record + returns hosted SheerID URL.
 *   2. User completes the SheerID-hosted flow.
 *   3. SheerID either calls our webhook OR client polls `/student-verifications/me`.
 *   4. We reconcile against SheerID's `inquiry/{verificationId}` endpoint.
 */
@Injectable()
export class StudentVerificationService {
  private readonly logger = new Logger(StudentVerificationService.name);

  constructor(
    private readonly prismaService: PrismaService,
    private readonly configService: ConfigService,
    private readonly auditEventEmitter: AuditEventEmitterService,
  ) {}

  async initiateForUser(
    userId: string,
    input: InitiateStudentVerificationInput,
  ): Promise<StudentVerificationRecord> {
    const programId = this.getProgramId();

    const existingVerified = await this.prismaService.studentVerification.findFirst({
      where: { userId, status: 'VERIFIED' },
    });
    if (existingVerified && (!existingVerified.expiresAt || existingVerified.expiresAt > new Date())) {
      throw new ConflictException('User is already verified as a student');
    }

    const existingPending = await this.prismaService.studentVerification.findFirst({
      where: { userId, status: 'PENDING' },
      orderBy: { createdAt: 'desc' },
    });
    if (existingPending) {
      return this.toRecord(existingPending);
    }

    const redirectUrl = this.buildRedirectUrl(programId, userId, input.successRedirectUrl);
    const created = await this.prismaService.studentVerification.create({
      data: {
        userId,
        programId,
        provider: 'sheerid',
        status: 'PENDING',
        redirectUrl,
        metadata: input.successRedirectUrl
          ? { successRedirectUrl: input.successRedirectUrl }
          : undefined,
      },
    });

    this.auditEventEmitter.emit({
      eventType: 'student_verification.initiated',
      category: 'payments',
      actorUserId: userId,
      entityType: 'student_verification',
      entityId: created.id,
      metadata: { programId },
    });

    return this.toRecord(created);
  }

  async getCurrentForUser(userId: string): Promise<StudentVerificationRecord | null> {
    const record = await this.prismaService.studentVerification.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
    return record ? this.toRecord(record) : null;
  }

  async refreshFromProvider(
    userId: string,
    verificationId: string,
  ): Promise<StudentVerificationRecord> {
    const record = await this.prismaService.studentVerification.findFirst({
      where: { userId, verificationId },
    });
    if (!record) {
      throw new NotFoundException('Student verification record not found');
    }

    const remote = await this.fetchSheerIdStatus(verificationId);
    const next = this.deriveStatus(remote.currentStep);
    const updated = await this.prismaService.studentVerification.update({
      where: { id: record.id },
      data: {
        status: next,
        verifiedAt: next === 'VERIFIED' ? new Date() : record.verifiedAt,
        rejectionReason:
          next === 'REJECTED' ? (remote.errorIds?.join(',') ?? 'rejected') : record.rejectionReason,
        metadata: {
          ...((record.metadata as Record<string, unknown> | null) ?? {}),
          lastRemote: JSON.parse(JSON.stringify(remote)) as unknown,
        } as object,
      },
    });

    return this.toRecord(updated);
  }

  async handleWebhook(rawBody: Buffer, signatureHeader: string | undefined): Promise<void> {
    const secret = this.configService.get<string>('sheerIdWebhookSecret')?.trim();
    if (!secret) {
      throw new ServiceUnavailableException('SheerID webhook secret is not configured');
    }
    if (!signatureHeader) {
      throw new UnauthorizedException('Missing SheerID signature header');
    }

    const expected = createHmac('sha256', secret).update(rawBody).digest('hex');
    const provided = signatureHeader.trim();

    let valid = false;
    try {
      const a = Buffer.from(expected, 'hex');
      const b = Buffer.from(provided, 'hex');
      valid = a.length === b.length && timingSafeEqual(a, b);
    } catch {
      valid = false;
    }
    if (!valid) {
      throw new UnauthorizedException('Invalid SheerID webhook signature');
    }

    let payload: SheerIdWebhookPayload;
    try {
      payload = JSON.parse(rawBody.toString('utf8')) as SheerIdWebhookPayload;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'unknown error';
      throw new UnauthorizedException(`Invalid SheerID webhook payload: ${message}`);
    }

    if (!payload.verificationId) {
      this.logger.warn('SheerID webhook missing verificationId; ignoring');
      return;
    }

    const record = await this.prismaService.studentVerification.findUnique({
      where: { verificationId: payload.verificationId },
    });
    if (!record) {
      this.logger.log(
        `SheerID webhook for unknown verificationId ${payload.verificationId}; ignoring`,
      );
      return;
    }

    const next = this.deriveStatus(payload.currentStep);
    const updated = await this.prismaService.studentVerification.update({
      where: { id: record.id },
      data: {
        status: next,
        verifiedAt: next === 'VERIFIED' ? new Date() : record.verifiedAt,
        rejectionReason:
          next === 'REJECTED'
            ? (payload.errorIds?.join(',') ?? 'rejected')
            : record.rejectionReason,
        metadata: {
          ...((record.metadata as Record<string, unknown> | null) ?? {}),
          lastWebhook: JSON.parse(JSON.stringify(payload)) as unknown,
        } as object,
      },
    });

    this.auditEventEmitter.emit({
      eventType: `student_verification.webhook.${next.toLowerCase()}`,
      category: 'payments',
      actorType: 'SYSTEM',
      entityType: 'student_verification',
      entityId: updated.id,
      metadata: { verificationId: payload.verificationId },
    });
  }

  async attachVerificationId(
    userId: string,
    recordId: string,
    verificationId: string,
  ): Promise<StudentVerificationRecord> {
    const record = await this.prismaService.studentVerification.findFirst({
      where: { id: recordId, userId },
    });
    if (!record) {
      throw new NotFoundException('Student verification record not found');
    }
    if (record.verificationId && record.verificationId !== verificationId) {
      throw new ConflictException('Verification id is already bound to a different value');
    }

    const updated = await this.prismaService.studentVerification.update({
      where: { id: record.id },
      data: { verificationId },
    });

    return this.toRecord(updated);
  }

  private async fetchSheerIdStatus(verificationId: string): Promise<SheerIdVerificationStatus> {
    const baseUrl = this.configService.get<string>('sheerIdBaseUrl')?.trim();
    const apiKey = this.configService.get<string>('sheerIdApiKey')?.trim();
    if (!baseUrl || !apiKey) {
      throw new ServiceUnavailableException('SheerID is not configured');
    }

    const response = await fetch(
      `${baseUrl}/rest/v2/verification/${encodeURIComponent(verificationId)}`,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          Accept: 'application/json',
        },
      },
    );

    if (!response.ok) {
      throw new ServiceUnavailableException(
        `SheerID status request failed (HTTP ${response.status})`,
      );
    }

    return (await response.json()) as SheerIdVerificationStatus;
  }

  private deriveStatus(currentStep: string | undefined): StudentVerificationStatusValue {
    if (!currentStep) return 'PENDING';
    if (STEP_VERIFIED.includes(currentStep)) return 'VERIFIED';
    if (STEP_REJECTED.includes(currentStep)) return 'REJECTED';
    return 'PENDING';
  }

  private buildRedirectUrl(
    programId: string,
    userId: string,
    successRedirectUrl: string | undefined,
  ): string {
    const base = this.configService
      .get<string>('sheerIdRedirectBaseUrl')
      ?.replace(/\/$/, '') ?? 'https://services.sheerid.com/verify';
    const params = new URLSearchParams({ trackingId: userId });
    if (successRedirectUrl) {
      params.set('successRedirect', successRedirectUrl);
    }
    return `${base}/${encodeURIComponent(programId)}/?${params.toString()}`;
  }

  private getProgramId(): string {
    const programId = this.configService.get<string>('sheerIdProgramId')?.trim();
    if (!programId) {
      throw new ServiceUnavailableException('SheerID program id is not configured');
    }
    return programId;
  }

  private toRecord(record: {
    id: string;
    userId: string;
    provider: string;
    programId: string;
    verificationId: string | null;
    status: StudentVerificationStatusValue;
    redirectUrl: string | null;
    rejectionReason: string | null;
    verifiedAt: Date | null;
    expiresAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  }): StudentVerificationRecord {
    return {
      id: record.id,
      userId: record.userId,
      provider: record.provider,
      programId: record.programId,
      verificationId: record.verificationId,
      status: record.status,
      redirectUrl: record.redirectUrl,
      rejectionReason: record.rejectionReason,
      verifiedAt: record.verifiedAt?.toISOString() ?? null,
      expiresAt: record.expiresAt?.toISOString() ?? null,
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString(),
    };
  }
}
