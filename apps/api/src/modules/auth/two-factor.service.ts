import { Injectable, UnauthorizedException } from '@nestjs/common';
import { authenticator } from 'otplib';
import { ConfigService } from '@nestjs/config';
import type { TwoFactorMethodType } from '@prisma/client';
import { appLogger } from '../../common/logger';
import { PrismaService } from '../../prisma.service';
import { RedisService } from '../../redis.service';
import { AuditEventEmitterService } from '../audit/audit-event-emitter.service';
import { auditableEvents } from '../audit/audit.constants';
import { PasswordService } from './password.service';
import type { SendTwoFactorCodeDto } from './dto/send-two-factor-code.dto';
import type { SetupAuthenticatorDto } from './dto/setup-authenticator.dto';
import type { VerifyTwoFactorDto } from './dto/verify-two-factor.dto';
import { sendTwoFactorCodeSchema } from './schemas/send-two-factor-code.schema';
import { setupAuthenticatorSchema } from './schemas/setup-authenticator.schema';
import { verifyTwoFactorSchema } from './schemas/verify-two-factor.schema';

interface TwoFactorRecipientInput {
  userId: string;
  method: TwoFactorMethodType;
  dto: SendTwoFactorCodeDto;
}

@Injectable()
export class TwoFactorService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly redisService: RedisService,
    private readonly passwordService: PasswordService,
    private readonly configService: ConfigService,
    private readonly auditEventEmitter: AuditEventEmitterService,
  ) {}

  async sendWhatsAppCode(userId: string, dto: SendTwoFactorCodeDto) {
    return this.sendCode({ userId, method: 'WHATSAPP', dto });
  }

  async sendTelegramCode(userId: string, dto: SendTwoFactorCodeDto) {
    return this.sendCode({ userId, method: 'TELEGRAM', dto });
  }

  async setupAuthenticator(userId: string, dto: SetupAuthenticatorDto) {
    const payload = setupAuthenticatorSchema.parse(dto);
    const secret = authenticator.generateSecret();
    const label = payload.label ?? 'Authenticator';
    const appName = this.configService.get<string>('appUrl', 'formatedit');
    const otpauthUrl = authenticator.keyuri(userId, appName, secret);

    const existingMethod = await this.prismaService.twoFactorMethod.findFirst({
      where: {
        userId,
        type: 'AUTHENTICATOR',
      },
    });

    const method = existingMethod
      ? await this.prismaService.twoFactorMethod.update({
          where: { id: existingMethod.id },
          data: {
            label,
            secret,
            isVerified: false,
          },
        })
      : await this.prismaService.twoFactorMethod.create({
          data: {
            userId,
            type: 'AUTHENTICATOR',
            label,
            secret,
            isVerified: false,
          },
        });

    return {
      methodId: method.id,
      method: 'AUTHENTICATOR' as const,
      label,
      secret,
      otpauthUrl,
    };
  }

  async verify(userId: string, dto: VerifyTwoFactorDto) {
    const payload = verifyTwoFactorSchema.parse(dto);

    if (payload.method === 'AUTHENTICATOR') {
      return this.verifyAuthenticator(userId, payload.methodId, payload.code);
    }

    return this.verifyChannelCode(userId, payload.method, payload.recipient, payload.code);
  }

  private async verifyAuthenticator(userId: string, methodId: string | undefined, code: string) {
    if (!methodId) {
      throw new UnauthorizedException('Authenticator method id is required');
    }

    const method = await this.prismaService.twoFactorMethod.findFirst({
      where: {
        id: methodId,
        userId,
        type: 'AUTHENTICATOR',
      },
    });

    if (!method?.secret) {
      throw new UnauthorizedException('Authenticator method was not found');
    }

    const isValid = authenticator.check(code, method.secret);
    if (!isValid) {
      throw new UnauthorizedException('Invalid authenticator code');
    }

    await this.prismaService.twoFactorMethod.update({
      where: { id: method.id },
      data: { isVerified: true },
    });

    this.auditEventEmitter.emit({
      eventType: auditableEvents.twoFactorVerified,
      category: 'auth',
      actorUserId: userId,
      entityType: 'two_factor_method',
      entityId: method.id,
      metadata: {
        method: 'AUTHENTICATOR',
      },
    });

    return {
      success: true as const,
      method: 'AUTHENTICATOR' as const,
      verified: true,
    };
  }

  private async verifyChannelCode(
    userId: string,
    method: Extract<TwoFactorMethodType, 'WHATSAPP' | 'TELEGRAM'>,
    recipient: string | undefined,
    code: string,
  ) {
    if (!recipient) {
      throw new UnauthorizedException('Recipient is required for channel verification');
    }

    const redisClient = this.redisService.getClient();
    const challengeKey = this.getChallengeKey(userId, method, recipient);
    const rawChallenge = await redisClient.get(challengeKey);

    if (!rawChallenge) {
      throw new UnauthorizedException('Two-factor verification challenge was not found or expired');
    }

    const parsedChallenge = JSON.parse(rawChallenge) as {
      codeHash: string;
      label: string;
    };
    const isValid = await this.passwordService.verifyOneTimeCode(code, parsedChallenge.codeHash);

    if (!isValid) {
      throw new UnauthorizedException('Invalid two-factor code');
    }

    const methodRecord = await this.prismaService.twoFactorMethod.findFirst({
      where: {
        userId,
        type: method,
        label: parsedChallenge.label,
      },
    });

    if (methodRecord) {
      await this.prismaService.twoFactorMethod.update({
        where: { id: methodRecord.id },
        data: { isVerified: true },
      });
    }

    await redisClient.del(challengeKey);

    this.auditEventEmitter.emit({
      eventType: auditableEvents.twoFactorVerified,
      category: 'auth',
      actorUserId: userId,
      entityType: 'two_factor_method',
      entityId: methodRecord?.id,
      metadata: {
        method,
        recipient,
      },
    });

    return {
      success: true as const,
      method,
      verified: true,
    };
  }

  private async sendCode(input: TwoFactorRecipientInput) {
    const payload = sendTwoFactorCodeSchema.parse(input.dto);
    const code = this.passwordService.generateOneTimeCode();
    const codeHash = await this.passwordService.hashOneTimeCode(code);
    const ttlSeconds = this.configService.get<number>('twoFactorCodeTtlSeconds', 300);
    const normalizedLabel = payload.label ?? payload.recipient;

    const existingMethod = await this.prismaService.twoFactorMethod.findFirst({
      where: {
        userId: input.userId,
        type: input.method,
        label: normalizedLabel,
      },
    });

    const persistedMethod = existingMethod
      ? await this.prismaService.twoFactorMethod.update({
          where: { id: existingMethod.id },
          data: {
            label: normalizedLabel,
            isVerified: false,
          },
        })
      : await this.prismaService.twoFactorMethod.create({
          data: {
            userId: input.userId,
            type: input.method,
            label: normalizedLabel,
            isVerified: false,
          },
        });

    const redisClient = this.redisService.getClient();
    await redisClient.set(
      this.getChallengeKey(input.userId, input.method, payload.recipient),
      JSON.stringify({
        codeHash,
        recipient: payload.recipient,
        label: normalizedLabel,
        method: input.method,
      }),
      'EX',
      ttlSeconds,
    );

    this.logCodeDispatch({
      method: input.method,
      recipient: payload.recipient,
      code,
      userId: input.userId,
    });

    this.auditEventEmitter.emit({
      eventType: auditableEvents.twoFactorChallengeSent,
      category: 'auth',
      actorUserId: input.userId,
      entityType: 'two_factor_method',
      entityId: persistedMethod.id,
      metadata: {
        method: input.method,
        recipient: payload.recipient,
        label: normalizedLabel,
      },
    });

    return {
      success: true as const,
      method: input.method,
      expiresInSeconds: ttlSeconds,
      deliveryMode: 'log',
    };
  }

  private getChallengeKey(userId: string, method: TwoFactorMethodType, recipient: string): string {
    return `two-factor:${userId}:${method}:${recipient}`;
  }

  private logCodeDispatch(input: {
    userId: string;
    method: TwoFactorMethodType;
    recipient: string;
    code: string;
  }): void {
    appLogger.info('Two-factor code dispatched through development transport', {
      userId: input.userId,
      method: input.method,
      recipient: input.recipient,
      code: input.code,
    });
  }
}
