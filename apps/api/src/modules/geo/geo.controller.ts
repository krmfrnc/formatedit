import { Controller, Get, Headers, Req } from '@nestjs/common';
import type { Request } from 'express';
import type { GeoCurrencyResolution } from '@formatedit/shared';
import { GeoCurrencyService } from './geo-currency.service';

@Controller('geo')
export class GeoController {
  constructor(private readonly geoCurrencyService: GeoCurrencyService) {}

  @Get('currency')
  resolveCurrency(
    @Headers() headers: Record<string, string | string[] | undefined>,
    @Req() request: Request,
  ): Promise<GeoCurrencyResolution> {
    return this.geoCurrencyService.resolve(headers, request.socket?.remoteAddress ?? null);
  }
}
