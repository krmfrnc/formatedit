import { Injectable } from '@nestjs/common';
import type { HealthStatus } from '@formatedit/shared';

@Injectable()
export class AppService {
  getHealthStatus(): HealthStatus {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }
}
