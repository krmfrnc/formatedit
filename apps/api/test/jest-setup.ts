/**
 * Global Jest setup — runs once per worker before any test file loads.
 *
 * Responsibilities:
 *  1. Force `NODE_ENV=test` so any code reading it branches to test defaults.
 *  2. Populate environment variables that `env.validation.ts` marks as
 *     required, using deterministic in-memory / localhost values. This lets
 *     unit tests instantiate `ConfigModule` (or modules that depend on it)
 *     without relying on a real `.env` file.
 *
 *  Tests that need to override a variable can still set `process.env.X`
 *  inside their own `beforeEach` — these defaults are only a floor.
 */

process.env.NODE_ENV = process.env.NODE_ENV ?? 'test';

const defaults: Record<string, string> = {
  PORT: '3000',
  APP_URL: 'http://localhost:3000',
  API_URL: 'http://localhost:3001',
  DATABASE_URL: 'postgresql://test:test@localhost:5432/formatedit_test',
  REDIS_URL: 'redis://localhost:6379/1',
  JWT_SECRET: 'test-jwt-secret-do-not-use-in-production',
  JWT_ACCESS_TOKEN_TTL: '15m',
  JWT_REFRESH_TOKEN_TTL: '7d',
  TWO_FACTOR_CODE_TTL_SECONDS: '300',
  AUDIT_RETENTION_DAYS: '90',
  AUDIT_RETENTION_JOB_INTERVAL_MINUTES: '60',
  DEFAULT_MAX_UPLOAD_SIZE_BYTES: '52428800',
  CLAMAV_HOST: 'localhost',
  CLAMAV_PORT: '3310',
  STORAGE_PROVIDER: 'minio',
  S3_REGION: 'us-east-1',
  MINIO_BUCKET: 'formatedit-test',
  MINIO_ENDPOINT: 'http://localhost:9000',
  S3_ACCESS_KEY_ID: 'test-access-key',
  S3_SECRET_ACCESS_KEY: 'test-secret-key',
};

for (const [key, value] of Object.entries(defaults)) {
  if (process.env[key] === undefined) {
    process.env[key] = value;
  }
}
