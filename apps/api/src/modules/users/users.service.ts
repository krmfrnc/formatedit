import { Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../../prisma.service';
import type { AcademicTitle, NotificationPreference, OAuthProvider, ThemePreference, User, UserRole } from '@prisma/client';
import type { ImpersonationHistoryEntry, NotificationPreferences, UserProfile } from '@formatedit/shared';
import { AuditEventEmitterService } from '../audit/audit-event-emitter.service';
import { auditableEvents } from '../audit/audit.constants';
import type { UpdateNotificationPreferencesDto } from './dto/update-notification-preferences.dto';
import type { UpdateProfileDto } from './dto/update-profile.dto';
import { updateNotificationPreferencesSchema } from './schemas/update-notification-preferences.schema';
import { updateProfileSchema } from './schemas/update-profile.schema';

interface CreateUserInput {
  email: string;
  passwordHash: string;
  academicTitle: AcademicTitle;
}

@Injectable()
export class UsersService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly auditEventEmitter: AuditEventEmitterService,
  ) {}

  findByEmail(email: string) {
    return this.prismaService.user.findUnique({
      where: { email },
    });
  }

  findById(id: string) {
    return this.prismaService.user.findUnique({
      where: { id },
    });
  }

  createUser(input: CreateUserInput) {
    return this.prismaService.user.create({
      data: {
        email: input.email,
        passwordHash: input.passwordHash,
        academicTitle: input.academicTitle,
        notificationPreference: {
          create: {},
        },
      },
    });
  }

  async getProfile(userId: string): Promise<UserProfile> {
    const user = await this.prismaService.user.findUnique({
      where: { id: userId },
      include: {
        notificationPreference: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User profile was not found');
    }

    return this.toUserProfile(user, user.notificationPreference);
  }

  async updateProfile(userId: string, dto: UpdateProfileDto): Promise<UserProfile> {
    const payload = updateProfileSchema.parse(dto);
    const user = await this.prismaService.user.update({
      where: { id: userId },
      data: payload,
      include: {
        notificationPreference: true,
      },
    });

    this.auditEventEmitter.emit({
      eventType: auditableEvents.profileUpdated,
      category: 'users',
      actorUserId: userId,
      actorRole: user.role,
      entityType: 'user',
      entityId: userId,
      metadata: payload,
    });

    return this.toUserProfile(user, user.notificationPreference);
  }

  async getNotificationPreferences(userId: string): Promise<NotificationPreferences> {
    const preferences = await this.ensureNotificationPreferences(userId);
    return this.toNotificationPreferences(preferences);
  }

  async updateNotificationPreferences(
    userId: string,
    dto: UpdateNotificationPreferencesDto,
  ): Promise<NotificationPreferences> {
    const payload = updateNotificationPreferencesSchema.parse(dto);
    const preferences = await this.ensureNotificationPreferences(userId);
    const updatedPreferences = await this.prismaService.notificationPreference.update({
      where: { id: preferences.id },
      data: payload,
    });

    const user = await this.findById(userId);
    this.auditEventEmitter.emit({
      eventType: auditableEvents.notificationPreferencesUpdated,
      category: 'users',
      actorUserId: userId,
      actorRole: user?.role,
      entityType: 'notification_preference',
      entityId: updatedPreferences.id,
      metadata: payload,
    });

    return this.toNotificationPreferences(updatedPreferences);
  }

  async getImpersonationHistory(userId: string): Promise<ImpersonationHistoryEntry[]> {
    const sessions = await this.prismaService.impersonationSession.findMany({
      where: { targetUserId: userId },
      orderBy: { startedAt: 'desc' },
      take: 10,
    });

    return sessions.map((session) => ({
      id: session.id,
      adminId: session.adminId,
      startedAt: session.startedAt.toISOString(),
      endedAt: session.endedAt?.toISOString() ?? null,
      reason: session.reason,
    }));
  }

  async findUserByOAuth(provider: OAuthProvider, providerAccountId: string) {
    const account = await this.prismaService.oAuthAccount.findUnique({
      where: {
        provider_providerAccountId: {
          provider,
          providerAccountId,
        },
      },
      include: {
        user: true,
      },
    });

    return account?.user ?? null;
  }

  async createGoogleUser(input: {
    email: string;
    providerAccountId: string;
    providerEmail?: string;
  }): Promise<User> {
    return this.prismaService.user.create({
      data: {
        email: input.email,
        passwordHash: '',
        academicTitle: 'OTHER',
        isEmailVerified: true,
        notificationPreference: {
          create: {},
        },
        oauthAccounts: {
          create: {
            provider: 'GOOGLE',
            providerAccountId: input.providerAccountId,
            providerEmail: input.providerEmail,
          },
        },
      },
    });
  }

  async linkGoogleAccount(input: {
    userId: string;
    providerAccountId: string;
    providerEmail?: string;
  }) {
    return this.prismaService.oAuthAccount.upsert({
      where: {
        provider_providerAccountId: {
          provider: 'GOOGLE',
          providerAccountId: input.providerAccountId,
        },
      },
      update: {
        providerEmail: input.providerEmail,
      },
      create: {
        userId: input.userId,
        provider: 'GOOGLE',
        providerAccountId: input.providerAccountId,
        providerEmail: input.providerEmail,
      },
    });
  }

  async anonymizeUserAccount(userId: string): Promise<{ success: true; anonymizedAt: string }> {
    const user = await this.findById(userId);
    if (!user) {
      throw new NotFoundException('User account was not found');
    }

    const anonymizedAt = user.anonymizedAt ?? new Date();

    const updatedUser = await this.prismaService.user.update({
      where: { id: userId },
      data: {
        email: `deleted+${user.id}@anonymized.local`,
        passwordHash: `deleted-${randomUUID()}`,
        fullName: null,
        phoneNumber: null,
        telegramChatId: null,
        country: null,
        isEmailVerified: false,
        deletedAt: user.deletedAt ?? anonymizedAt,
        anonymizedAt,
      },
    });

    await this.prismaService.refreshToken.updateMany({
      where: {
        userId,
        revokedAt: null,
      },
      data: {
        revokedAt: anonymizedAt,
      },
    });

    this.auditEventEmitter.emit({
      eventType: auditableEvents.accountAnonymized,
      category: 'users',
      actorUserId: userId,
      actorRole: user.role,
      entityType: 'user',
      entityId: userId,
      metadata: {
        anonymizedAt: anonymizedAt.toISOString(),
        previousEmail: user.email,
        anonymizedEmail: updatedUser.email,
      },
    });

    return {
      success: true as const,
      anonymizedAt: anonymizedAt.toISOString(),
    };
  }

  /**
   * Task 307: KVKK / GDPR data export. Returns the user's profile and the
   * pieces of data they own across the platform. The dump is JSON-only —
   * binary artefacts (uploaded DOCX, generated PDFs) live in storage and
   * are referenced by their storage key so the user can fetch them via
   * the regular signed-URL flow.
   */
  async exportUserData(userId: string): Promise<{
    exportedAt: string;
    profile: User | null;
    documents: unknown[];
    payments: unknown[];
    invoices: unknown[];
    analysisTickets: unknown[];
    notifications: unknown[];
    auditLogs: unknown[];
  }> {
    const [profile, documents, payments, invoices, analysisTickets, notifications, auditLogs] =
      await Promise.all([
        this.prismaService.user.findUnique({ where: { id: userId } }),
        this.prismaService.document.findMany({ where: { userId } }).catch(() => []),
        this.prismaService.payment.findMany({ where: { userId } }).catch(() => []),
        this.prismaService.invoice.findMany({ where: { userId } }).catch(() => []),
        this.prismaService.analysisTicket
          .findMany({ where: { customerUserId: userId } })
          .catch(() => []),
        this.prismaService.notification.findMany({ where: { userId } }).catch(() => []),
        this.prismaService.auditLog.findMany({ where: { actorUserId: userId } }).catch(() => []),
      ]);

    if (!profile) throw new NotFoundException('User not found');

    return {
      exportedAt: new Date().toISOString(),
      profile,
      documents,
      payments,
      invoices,
      analysisTickets,
      notifications,
      auditLogs,
    };
  }

  toRegisteredUser(user: {
    id: string;
    email: string;
    role: UserRole;
    academicTitle: AcademicTitle;
    createdAt: Date;
  }) {
    return {
      id: user.id,
      email: user.email,
      role: user.role,
      academicTitle: user.academicTitle,
      createdAt: user.createdAt.toISOString(),
    };
  }

  private async ensureNotificationPreferences(userId: string): Promise<NotificationPreference> {
    const existing = await this.prismaService.notificationPreference.findUnique({
      where: { userId },
    });

    if (existing) {
      return existing;
    }

    return this.prismaService.notificationPreference.create({
      data: { userId },
    });
  }

  private toNotificationPreferences(preferences: NotificationPreference): NotificationPreferences {
    return {
      emailEnabled: preferences.emailEnabled,
      inAppEnabled: preferences.inAppEnabled,
      whatsappEnabled: preferences.whatsappEnabled,
      telegramEnabled: preferences.telegramEnabled,
    };
  }

  private toUserProfile(
    user: {
      id: string;
      email: string;
      fullName: string | null;
      role: UserRole;
      academicTitle: AcademicTitle;
      preferredLanguage: string;
      themePreference: ThemePreference;
      createdAt: Date;
    },
    preferences: NotificationPreference | null,
  ): UserProfile {
    return {
      ...this.toRegisteredUser(user),
      fullName: user.fullName,
      preferredLanguage: user.preferredLanguage,
      themePreference: user.themePreference,
      notificationPreferences: this.toNotificationPreferences(
        preferences ?? {
          id: 'virtual',
          userId: user.id,
          emailEnabled: true,
          inAppEnabled: true,
          whatsappEnabled: false,
          telegramEnabled: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ),
    };
  }
}
