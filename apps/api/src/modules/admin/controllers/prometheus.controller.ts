import { Controller, Get, Header } from '@nestjs/common';
import { PrometheusService } from '../services/prometheus.service';

/**
 * Task 286: `GET /metrics` in Prometheus 0.0.4 text exposition format.
 *
 * Intentionally unauthenticated — Prometheus scrapers typically live inside
 * the cluster and don't carry bearer tokens. In production we gate this path
 * at the ingress / service mesh (allow only the monitoring namespace). If
 * external exposure is needed later, add a shared-secret header check here.
 */
@Controller('metrics')
export class PrometheusController {
  constructor(private readonly prometheusService: PrometheusService) {}

  @Get()
  @Header('Content-Type', 'text/plain; version=0.0.4; charset=utf-8')
  @Header('Cache-Control', 'no-store')
  async metrics(): Promise<string> {
    return this.prometheusService.renderMetrics();
  }
}
