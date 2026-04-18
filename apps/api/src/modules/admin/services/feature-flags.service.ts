import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, type FeatureFlag, type FeatureFlagAudience } from '@prisma/client';
import { PrismaService } from '../../../prisma.service';

export interface FlagEvaluationContext {
  userId?: string;
  userRole?: 'USER' | 'ADMIN' | 'EXPERT';
}

export interface UpsertFeatureFlagInput {
  key: string;
  description?: string | null;
  enabled: boolean;
  audience: FeatureFlagAudience;
  rolloutPercent?: number;
  allowedUserIds?: string[];
  metadata?: Record<string, unknown>;
}

/**
 * Task 272: Runtime feature-flag evaluation. Flags live in `feature_flags` so
 * they can be toggled without a deploy. Audience strategies:
 *   - EVERYONE: enabled flag → on for all
 *   - ADMINS_ONLY: only when context.userRole === 'ADMIN'
 *   - PERCENTAGE_ROLLOUT: stable hash(userId+key) modulo 100 < rolloutPercent
 *   - USER_LIST: opt-in by explicit user id
 */
@Injectable()
export class FeatureFlagsService {
  constructor(private readonly prismaService: PrismaService) {}

  async list(): Promise<FeatureFlag[]> {
    return this.prismaService.featureFlag.findMany({ orderBy: { key: 'asc' } });
  }

  async get(key: string): Promise<FeatureFlag> {
    const flag = await this.prismaService.featureFlag.findUnique({ where: { key } });
    if (!flag) throw new NotFoundException(`Feature flag ${key} not found`);
    return flag;
  }

  async upsert(input: UpsertFeatureFlagInput, updatedBy: string | null): Promise<FeatureFlag> {
    const data = {
      description: input.description ?? null,
      enabled: input.enabled,
      audience: input.audience,
      rolloutPercent: input.rolloutPercent ?? 0,
      allowedUserIds: input.allowedUserIds
        ? (input.allowedUserIds as unknown as Prisma.InputJsonValue)
        : Prisma.JsonNull,
      metadata: input.metadata
        ? (JSON.parse(JSON.stringify(input.metadata)) as Prisma.InputJsonValue)
        : Prisma.JsonNull,
      updatedBy: updatedBy ?? undefined,
    };
    return this.prismaService.featureFlag.upsert({
      where: { key: input.key },
      create: { key: input.key, ...data },
      update: data,
    });
  }

  async delete(key: string): Promise<void> {
    await this.prismaService.featureFlag.delete({ where: { key } }).catch(() => undefined);
  }

  async isEnabled(key: string, context: FlagEvaluationContext = {}): Promise<boolean> {
    const flag = await this.prismaService.featureFlag.findUnique({ where: { key } });
    if (!flag || !flag.enabled) return false;
    return this.evaluate(flag, context);
  }

  private evaluate(flag: FeatureFlag, context: FlagEvaluationContext): boolean {
    switch (flag.audience) {
      case 'EVERYONE':
        return true;
      case 'ADMINS_ONLY':
        return context.userRole === 'ADMIN';
      case 'PERCENTAGE_ROLLOUT':
        if (!context.userId) return false;
        return this.stableHash(`${context.userId}:${flag.key}`) % 100 < flag.rolloutPercent;
      case 'USER_LIST': {
        if (!context.userId) return false;
        const list = Array.isArray(flag.allowedUserIds) ? flag.allowedUserIds : [];
        return list.includes(context.userId);
      }
      default:
        return false;
    }
  }

  private stableHash(input: string): number {
    let hash = 0;
    for (let i = 0; i < input.length; i += 1) {
      hash = (hash * 31 + input.charCodeAt(i)) | 0;
    }
    return Math.abs(hash);
  }
}
