import * as Sentry from '@sentry/node';
import { appLogger } from './logger';

let sentryInitialized = false;

export function initializeSentry(dsn: string): void {
  if (!dsn || sentryInitialized) {
    return;
  }

  Sentry.init({
    dsn,
    tracesSampleRate: 0,
    profilesSampleRate: 0,
    environment: process.env.NODE_ENV ?? 'development',
  });

  sentryInitialized = true;
  appLogger.info('Sentry initialized for API');
}
