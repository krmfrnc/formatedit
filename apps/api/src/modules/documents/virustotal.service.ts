import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { VirusScanProviderResult } from './documents.types';

@Injectable()
export class VirusTotalService {
  constructor(private readonly configService: ConfigService) {}

  scanBuffer(_buffer: Buffer, enabled: boolean): Promise<VirusScanProviderResult> {
    if (!enabled) {
      return Promise.resolve({
        provider: 'virustotal',
        status: 'skipped',
        detail: 'VirusTotal scan is disabled by admin settings.',
      });
    }

    if (!this.configService.get<string>('virusTotalApiKey')) {
      return Promise.resolve({
        provider: 'virustotal',
        status: 'failed',
        detail: 'VirusTotal API key is not configured.',
      });
    }

    return Promise.resolve({
      provider: 'virustotal',
      status: 'clean',
      detail: 'Document accepted by VirusTotal integration stub.',
    });
  }
}
