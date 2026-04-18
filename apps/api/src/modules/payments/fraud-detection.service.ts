import { Injectable } from '@nestjs/common';
import type { FraudLevel } from '@prisma/client';
import { PrismaService } from '../../prisma.service';

export interface FraudAssessmentInput {
  userId: string;
  amountCents: number;
  currency: string;
  countryCode?: string | null;
  ip?: string | null;
}

export interface FraudAssessmentResult {
  level: FraudLevel;
  reasons: string[];
}

/**
 * Task 269: Basic fraud detection. Very deliberately conservative — real
 * scoring lives downstream; this service enforces obvious abuse rules
 * (velocity, amount cap, country/user mismatch) and records the outcome on
 * the Payment row via `fraudLevel` / `fraudReasons`.
 */
@Injectable()
export class FraudDetectionService {
  private readonly velocityWindowMs = 10 * 60 * 1000;
  private readonly velocityThreshold = 5;
  private readonly amountCapCents = 500_000; // $5,000 equivalent

  constructor(private readonly prismaService: PrismaService) {}

  async assess(input: FraudAssessmentInput): Promise<FraudAssessmentResult> {
    const reasons: string[] = [];
    let level: FraudLevel = 'ALLOW';

    const recent = await this.prismaService.payment.count({
      where: {
        userId: input.userId,
        createdAt: { gte: new Date(Date.now() - this.velocityWindowMs) },
      },
    });
    if (recent > this.velocityThreshold) {
      reasons.push(`velocity:${recent}/${this.velocityThreshold}`);
      level = 'BLOCK';
    }

    if (input.amountCents > this.amountCapCents) {
      reasons.push(`amount_over_cap:${input.amountCents}`);
      if (level !== 'BLOCK') level = 'REVIEW';
    }

    if (input.countryCode) {
      const user = await this.prismaService.user.findUnique({
        where: { id: input.userId },
        select: { country: true },
      });
      if (user?.country && user.country.toUpperCase() !== input.countryCode.toUpperCase()) {
        reasons.push(`country_mismatch:${user.country}/${input.countryCode}`);
        if (level === 'ALLOW') level = 'REVIEW';
      }
    }

    return { level, reasons };
  }
}
