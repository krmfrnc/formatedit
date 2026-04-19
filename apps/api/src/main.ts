import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { json, type Request } from 'express';
import { AppModule } from './app.module';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import { createGlobalValidationPipe } from './common/pipes/global-validation.pipe';
import { initializeSentry } from './common/sentry';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
    rawBody: true,
  });
  app.use(
    json({
      verify: (req, _res, buf) => {
        (req as Request & { rawBody?: Buffer }).rawBody = Buffer.from(buf);
      },
    }),
  );
  app.useGlobalPipes(createGlobalValidationPipe());
  app.useGlobalFilters(new GlobalExceptionFilter());

  const configService = app.get(ConfigService);
  app.enableCors({
    origin: [configService.get<string>('appUrl', 'http://localhost:3000')],
    credentials: true,
  });
  initializeSentry(configService.get<string>('sentryDsn', ''));

  const port = configService.getOrThrow<number>('port');
  await app.listen(port);

  Logger.log(`API listening on port ${port}`, 'Bootstrap');
}

void bootstrap();
