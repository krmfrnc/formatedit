import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { DocumentSecurityPolicy } from './documents.types';
import { PrismaService } from '../../prisma.service';

@Injectable()
export class DocumentSecuritySettingsService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  async getPolicy(): Promise<DocumentSecurityPolicy> {
    const setting = await this.prismaService.documentSecuritySetting.upsert({
      where: { id: 'default' },
      update: {},
      create: {
        id: 'default',
        maxUploadSizeBytes: this.configService.get<number>('defaultMaxUploadSizeBytes', 10485760),
        clamAvEnabled: false,
        virusTotalEnabled: false,
      },
    });

    return {
      maxUploadSizeBytes: setting.maxUploadSizeBytes,
      clamAvEnabled: setting.clamAvEnabled,
      virusTotalEnabled: setting.virusTotalEnabled,
    };
  }

  async updatePolicy(input: DocumentSecurityPolicy): Promise<DocumentSecurityPolicy> {
    const setting = await this.prismaService.documentSecuritySetting.upsert({
      where: { id: 'default' },
      update: input,
      create: {
        id: 'default',
        ...input,
      },
    });

    return {
      maxUploadSizeBytes: setting.maxUploadSizeBytes,
      clamAvEnabled: setting.clamAvEnabled,
      virusTotalEnabled: setting.virusTotalEnabled,
    };
  }
}
