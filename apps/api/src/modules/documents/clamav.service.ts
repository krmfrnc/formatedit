import { Injectable } from '@nestjs/common';
import type { VirusScanProviderResult } from './documents.types';

@Injectable()
export class ClamAvService {
  scanBuffer(_buffer: Buffer, enabled: boolean): Promise<VirusScanProviderResult> {
    if (!enabled) {
      return Promise.resolve({
        provider: 'clamav',
        status: 'skipped',
        detail: 'ClamAV scan is disabled by admin settings.',
      });
    }

    return Promise.resolve({
      provider: 'clamav',
      status: 'clean',
      detail: 'Document accepted by ClamAV integration stub.',
    });
  }
}
