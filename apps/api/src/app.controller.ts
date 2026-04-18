import { Controller, Get, InternalServerErrorException } from '@nestjs/common';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getRoot() {
    return this.appService.getHealthStatus();
  }

  @Get('debug/error')
  getDebugError(): never {
    throw new InternalServerErrorException('Synthetic failure');
  }
}
