import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService, type JwtSignOptions } from '@nestjs/jwt';
import { randomUUID } from 'node:crypto';
import { ConfigService } from '@nestjs/config';
import type { Profile } from 'passport-google-oauth20';
import type { AuthSession, AuthTokens, RegisteredUser } from '@formatedit/shared';
import type { AcademicTitle, RefreshToken, UserRole } from '@prisma/client';
import { PrismaService } from '../../prisma.service';
import { AuditEventEmitterService } from '../audit/audit-event-emitter.service';
import { auditableEvents } from '../audit/audit.constants';
import { UsersService } from '../users/users.service';
import { PasswordService } from './password.service';
import type { LoginDto } from './dto/login.dto';
import type { RefreshTokenDto } from './dto/refresh-token.dto';
import type { RegisterDto } from './dto/register.dto';
import type { StartImpersonationDto } from './dto/start-impersonation.dto';
import type { StopImpersonationDto } from './dto/stop-impersonation.dto';
import { loginSchema } from './schemas/login.schema';
import { refreshTokenSchema } from './schemas/refresh-token.schema';
import { registerSchema } from './schemas/register.schema';
import { startImpersonationSchema } from './schemas/start-impersonation.schema';

interface JwtPayload {
  sub: string;
  email: string;
  role: UserRole;
  impersonatedByUserId?: string;
  impersonationSessionId?: string;
}

interface ActiveAuthUser {
  id: string;
  email: string;
  role: UserRole;
  academicTitle: AcademicTitle;
  createdAt: Date;
  deletedAt?: Date | null;
  anonymizedAt?: Date | null;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly prismaService: PrismaService,
    private readonly auditEventEmitter: AuditEventEmitterService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly passwordService: PasswordService,
  ) {}

  async register(dto: RegisterDto): Promise<RegisteredUser> {
    const payload = registerSchema.parse(dto);
    const existingUser = await this.usersService.findByEmail(payload.email);

    if (existingUser) {
      throw new ConflictException('Email is already registered');
    }

    const passwordHash = await this.passwordService.hashPassword(payload.password);
    const user = await this.usersService.createUser({
      email: payload.email,
      passwordHash,
      academicTitle: payload.academicTitle,
    });

    this.auditEventEmitter.emit({
      eventType: auditableEvents.authRegister,
      category: 'auth',
      actorUserId: user.id,
      actorRole: user.role,
      entityType: 'user',
      entityId: user.id,
      metadata: {
        email: user.email,
      },
    });

    return this.usersService.toRegisteredUser(user);
  }

  async login(dto: LoginDto): Promise<AuthSession> {
    const payload = loginSchema.parse(dto);
    const user = await this.usersService.findByEmail(payload.email);

    if (!user || !user.passwordHash || user.deletedAt || user.anonymizedAt) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const isPasswordValid = await this.passwordService.verifyPassword(payload.password, user.passwordHash);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid email or password');
    }

    this.auditEventEmitter.emit({
      eventType: auditableEvents.authLogin,
      category: 'auth',
      actorUserId: user.id,
      actorRole: user.role,
      entityType: 'user',
      entityId: user.id,
    });

    return this.createSessionForUser(user);
  }

  async getCurrentUser(userId: string): Promise<RegisteredUser> {
    const user = await this.usersService.findById(userId);
    if (!user || user.deletedAt || user.anonymizedAt) {
      throw new UnauthorizedException('Authenticated user was not found');
    }

    return this.usersService.toRegisteredUser(user);
  }

  async startImpersonation(adminId: string, targetUserId: string, dto: StartImpersonationDto) {
    const payload = startImpersonationSchema.parse(dto);
    const admin = await this.usersService.findById(adminId);
    const targetUser = await this.usersService.findById(targetUserId);

    if (!admin || !targetUser) {
      throw new UnauthorizedException('Impersonation participants could not be resolved');
    }

    const session = await this.prismaService.impersonationSession.create({
      data: {
        adminId,
        targetUserId,
        reason: payload.reason,
      },
    });

    this.auditEventEmitter.emit({
      eventType: auditableEvents.impersonationStarted,
      category: 'auth',
      actorUserId: adminId,
      actorRole: admin.role,
      entityType: 'impersonation_session',
      entityId: session.id,
      targetUserId,
      metadata: {
        reason: payload.reason,
      },
    });

    const accessToken = await this.issueAccessToken({
      sub: targetUser.id,
      email: targetUser.email,
      role: targetUser.role,
      impersonatedByUserId: adminId,
      impersonationSessionId: session.id,
    });

    return {
      accessToken,
      impersonationSessionId: session.id,
      targetUser: this.usersService.toRegisteredUser(targetUser),
      bannerMessage: `Admin olarak ${targetUser.email} kullanicisi adina giris yaptiniz`,
    };
  }

  async stopImpersonation(adminId: string, dto: StopImpersonationDto, activeSessionId?: string) {
    const sessionId = dto.impersonationSessionId ?? activeSessionId;
    if (!sessionId) {
      throw new UnauthorizedException('Active impersonation session could not be resolved');
    }

    const session = await this.prismaService.impersonationSession.findUnique({
      where: { id: sessionId },
    });

    if (!session || session.adminId !== adminId) {
      throw new UnauthorizedException('Impersonation session does not belong to this admin');
    }

    await this.prismaService.impersonationSession.update({
      where: { id: sessionId },
      data: {
        endedAt: new Date(),
        lastActiveAt: new Date(),
      },
    });

    const admin = await this.usersService.findById(adminId);

    this.auditEventEmitter.emit({
      eventType: auditableEvents.impersonationStopped,
      category: 'auth',
      actorUserId: adminId,
      actorRole: admin?.role,
      entityType: 'impersonation_session',
      entityId: sessionId,
      targetUserId: session.targetUserId,
    });

    return { success: true as const, impersonationSessionId: sessionId };
  }

  async refreshSession(dto: RefreshTokenDto): Promise<AuthSession> {
    const payload = refreshTokenSchema.parse(dto);
    const storedTokens = await this.prismaService.refreshToken.findMany({
      where: {
        revokedAt: null,
        expiresAt: {
          gt: new Date(),
        },
      },
      include: {
        user: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    const matchedToken = await this.findMatchingRefreshToken(storedTokens, payload.refreshToken);

    if (!matchedToken) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    await this.prismaService.refreshToken.update({
      where: { id: matchedToken.id },
      data: { revokedAt: new Date() },
    });

    this.auditEventEmitter.emit({
      eventType: auditableEvents.authRefresh,
      category: 'auth',
      actorUserId: matchedToken.user.id,
      actorRole: matchedToken.user.role,
      entityType: 'refresh_token',
      entityId: matchedToken.id,
    });

    return this.createSessionForUser(matchedToken.user);
  }

  async logout(dto: RefreshTokenDto): Promise<{ success: true }> {
    const payload = refreshTokenSchema.parse(dto);
    const storedTokens = await this.prismaService.refreshToken.findMany({
      where: {
        revokedAt: null,
      },
    });

    const matchedToken = await this.findMatchingRefreshToken(storedTokens, payload.refreshToken);

    if (!matchedToken) {
      return { success: true };
    }

    await this.prismaService.refreshToken.update({
      where: { id: matchedToken.id },
      data: { revokedAt: new Date() },
    });

    this.auditEventEmitter.emit({
      eventType: auditableEvents.authLogout,
      category: 'auth',
      actorUserId: matchedToken.userId,
      entityType: 'refresh_token',
      entityId: matchedToken.id,
    });

    return { success: true };
  }

  async handleGoogleLogin(input: {
    accessToken: string;
    refreshToken: string;
    profile: Profile;
  }): Promise<AuthSession> {
    const providerAccountId = input.profile.id;
    const profileEmail = input.profile.emails?.[0]?.value?.toLowerCase();

    if (!profileEmail) {
      throw new UnauthorizedException('Google account email is required');
    }

    const existingOAuthUser = await this.usersService.findUserByOAuth('GOOGLE', providerAccountId);
    if (existingOAuthUser) {
      this.ensureUserIsActive(existingOAuthUser);
      return this.createSessionForUser(existingOAuthUser);
    }

    const existingUser = await this.usersService.findByEmail(profileEmail);
    if (existingUser) {
      this.ensureUserIsActive(existingUser);
      await this.usersService.linkGoogleAccount({
        userId: existingUser.id,
        providerAccountId,
        providerEmail: profileEmail,
      });

      return this.createSessionForUser(existingUser);
    }

    const createdUser = await this.usersService.createGoogleUser({
      email: profileEmail,
      providerAccountId,
      providerEmail: profileEmail,
    });

    return this.createSessionForUser(createdUser);
  }

  private async createSessionForUser(user: {
    id: string;
    email: string;
    role: UserRole;
    academicTitle: AcademicTitle;
    createdAt: Date;
    deletedAt?: Date | null;
    anonymizedAt?: Date | null;
  }): Promise<AuthSession> {
    this.ensureUserIsActive(user);
    const registeredUser = this.usersService.toRegisteredUser(user);
    const tokens = await this.issueTokens({
      sub: user.id,
      email: user.email,
      role: user.role,
    });

    return {
      user: registeredUser,
      tokens,
    };
  }

  private ensureUserIsActive(user: ActiveAuthUser): void {
    if (user.deletedAt || user.anonymizedAt) {
      throw new UnauthorizedException('Account is no longer available');
    }
  }

  private async issueTokens(payload: JwtPayload): Promise<AuthTokens> {
    const accessTokenExpiresIn = this.configService.get<string>('jwtAccessTokenTtl', '15m');
    const refreshTokenExpiresIn = this.configService.get<string>('jwtRefreshTokenTtl', '7d');
    const accessTokenOptions: JwtSignOptions = {
      expiresIn: accessTokenExpiresIn as JwtSignOptions['expiresIn'],
    };
    const refreshTokenOptions: JwtSignOptions = {
      expiresIn: refreshTokenExpiresIn as JwtSignOptions['expiresIn'],
    };

    const accessToken = await this.jwtService.signAsync(
      {
        ...payload,
        jti: randomUUID(),
      },
      accessTokenOptions,
    );
    const refreshToken = await this.jwtService.signAsync(
      {
        sub: payload.sub,
        email: payload.email,
        role: payload.role,
        type: 'refresh',
        jti: randomUUID(),
      },
      refreshTokenOptions,
    );

    const refreshTokenHash = await this.passwordService.hashPassword(refreshToken);
    const refreshTokenExpiresAt = this.calculateExpiration(refreshTokenExpiresIn);

    await this.prismaService.refreshToken.create({
      data: {
        userId: payload.sub,
        tokenHash: refreshTokenHash,
        expiresAt: refreshTokenExpiresAt,
      },
    });

    return {
      accessToken,
      refreshToken,
      accessTokenExpiresIn,
      refreshTokenExpiresIn,
    };
  }

  private async issueAccessToken(payload: JwtPayload): Promise<string> {
    const accessTokenExpiresIn = this.configService.get<string>('jwtAccessTokenTtl', '15m');
    return this.jwtService.signAsync(
      {
        ...payload,
        jti: randomUUID(),
      },
      {
        expiresIn: accessTokenExpiresIn as JwtSignOptions['expiresIn'],
      },
    );
  }

  private calculateExpiration(ttl: string): Date {
    const match = /^(\d+)([smhd])$/.exec(ttl);
    if (!match) {
      return new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    }

    const value = Number(match[1]);
    const unit = match[2];
    const unitToMs: Record<string, number> = {
      s: 1000,
      m: 60 * 1000,
      h: 60 * 60 * 1000,
      d: 24 * 60 * 60 * 1000,
    };

    return new Date(Date.now() + value * unitToMs[unit]);
  }

  private async findMatchingRefreshToken<
    T extends Pick<RefreshToken, 'tokenHash'>,
  >(tokens: T[], rawRefreshToken: string): Promise<T | null> {
    for (const token of tokens) {
      const isMatch = await this.passwordService.verifyPassword(rawRefreshToken, token.tokenHash);
      if (isMatch) {
        return token;
      }
    }

    return null;
  }
}
