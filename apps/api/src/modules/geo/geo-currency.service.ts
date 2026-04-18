import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { GeoCurrencyResolution } from '@formatedit/shared';
import { currencyForCountry } from './country-currency.map';

interface ProviderLookup {
  country?: string | null;
}

/**
 * Task 250: GeoIP-based currency resolution.
 *
 * Resolution order, cheapest first:
 *   1. CDN-injected headers (`cf-ipcountry`, `x-vercel-ip-country`).
 *   2. Optional external lookup (ipapi.co) — only if `GEOIP_PROVIDER=ipapi` is set.
 *   3. Default `USD`.
 *
 * IP is always normalized to the first entry of `x-forwarded-for` if present.
 */
@Injectable()
export class GeoCurrencyService {
  private readonly logger = new Logger(GeoCurrencyService.name);

  constructor(private readonly configService: ConfigService) {}

  async resolve(
    headers: Record<string, string | string[] | undefined>,
    socketRemoteAddress: string | null,
  ): Promise<GeoCurrencyResolution> {
    const headerCountry = this.firstHeader(headers, 'cf-ipcountry')
      ?? this.firstHeader(headers, 'x-vercel-ip-country');

    if (headerCountry && headerCountry.length === 2) {
      return this.build(headerCountry, 'cdn-header', this.extractIp(headers, socketRemoteAddress));
    }

    const ip = this.extractIp(headers, socketRemoteAddress);
    const provider = this.configService.get<string>('geoIpProvider')?.trim().toLowerCase();
    if (provider === 'ipapi' && ip) {
      try {
        const country = await this.lookupViaIpApi(ip);
        if (country) {
          return this.build(country, 'ipapi', ip);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'unknown error';
        this.logger.warn(`GeoIP lookup failed for ${ip}: ${message}`);
      }
    }

    return this.build(null, 'default', ip);
  }

  private build(
    country: string | null,
    source: GeoCurrencyResolution['source'],
    ip: string | null,
  ): GeoCurrencyResolution {
    const normalized = country?.trim().toUpperCase() ?? null;
    return {
      country: normalized,
      currency: currencyForCountry(normalized),
      source,
      ip,
    };
  }

  private async lookupViaIpApi(ip: string): Promise<string | null> {
    const response = await fetch(`https://ipapi.co/${encodeURIComponent(ip)}/json/`, {
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) {
      throw new ServiceUnavailableException(`ipapi returned HTTP ${response.status}`);
    }
    const payload = (await response.json()) as ProviderLookup;
    return payload.country ?? null;
  }

  private extractIp(
    headers: Record<string, string | string[] | undefined>,
    socketRemoteAddress: string | null,
  ): string | null {
    const forwarded = this.firstHeader(headers, 'x-forwarded-for');
    if (forwarded) {
      const first = forwarded.split(',')[0]?.trim();
      if (first) return first;
    }
    const realIp = this.firstHeader(headers, 'x-real-ip');
    if (realIp) return realIp;
    return socketRemoteAddress;
  }

  private firstHeader(
    headers: Record<string, string | string[] | undefined>,
    name: string,
  ): string | null {
    const value = headers[name] ?? headers[name.toLowerCase()];
    if (Array.isArray(value)) return value[0] ?? null;
    return value ?? null;
  }
}
