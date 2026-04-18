import { Module } from '@nestjs/common';
import { GeoController } from './geo.controller';
import { GeoCurrencyService } from './geo-currency.service';

@Module({
  controllers: [GeoController],
  providers: [GeoCurrencyService],
  exports: [GeoCurrencyService],
})
export class GeoModule {}
