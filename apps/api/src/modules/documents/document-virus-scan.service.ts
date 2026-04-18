import { Injectable } from '@nestjs/common';
import type { DocumentScanStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma.service';
import { ClamAvService } from './clamav.service';
import { DocumentSecuritySettingsService } from './document-security-settings.service';
import type { VirusScanProviderResult } from './documents.types';
import { VirusTotalService } from './virustotal.service';

@Injectable()
export class DocumentVirusScanService {
  constructor(
    private readonly documentSecuritySettingsService: DocumentSecuritySettingsService,
    private readonly prismaService: PrismaService,
    private readonly clamAvService: ClamAvService,
    private readonly virusTotalService: VirusTotalService,
  ) {}

  async scanUpload(documentId: string, buffer: Buffer): Promise<{
    scanStatus: DocumentScanStatus;
    providerResults: VirusScanProviderResult[];
  }> {
    const policy = await this.documentSecuritySettingsService.getPolicy();
    const providerResults = await Promise.all([
      this.clamAvService.scanBuffer(buffer, policy.clamAvEnabled),
      this.virusTotalService.scanBuffer(buffer, policy.virusTotalEnabled),
    ]);

    const scanStatus = this.resolveScanStatus(providerResults);

    await this.prismaService.document.update({
      where: { id: documentId },
      data: {
        currentScanStatus: scanStatus,
        lastScanDetails: providerResults as unknown as Prisma.InputJsonValue,
      },
    });

    return {
      scanStatus,
      providerResults,
    };
  }

  private resolveScanStatus(results: VirusScanProviderResult[]): DocumentScanStatus {
    if (results.some((result) => result.status === 'infected')) {
      return 'INFECTED';
    }

    if (results.some((result) => result.status === 'failed')) {
      return 'FAILED';
    }

    if (results.every((result) => result.status === 'skipped')) {
      return 'SKIPPED';
    }

    return 'CLEAN';
  }
}
