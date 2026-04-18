import { plainToInstance } from 'class-transformer';
import {
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  Min,
  validateSync,
} from 'class-validator';
import type { AppEnvironment } from '@formatedit/shared';

class EnvironmentVariables {
  @IsEnum(['development', 'test', 'production'])
  NODE_ENV!: AppEnvironment;

  @IsInt()
  @Min(1)
  PORT!: number;

  @IsUrl({ require_tld: false })
  APP_URL!: string;

  @IsUrl({ require_tld: false })
  API_URL!: string;

  @IsString()
  DATABASE_URL!: string;

  @IsString()
  REDIS_URL!: string;

  @IsString()
  JWT_SECRET!: string;

  @IsString()
  JWT_ACCESS_TOKEN_TTL!: string;

  @IsString()
  JWT_REFRESH_TOKEN_TTL!: string;

  @IsInt()
  @Min(60)
  TWO_FACTOR_CODE_TTL_SECONDS!: number;

  @IsInt()
  @Min(1)
  AUDIT_RETENTION_DAYS!: number;

  @IsInt()
  @Min(1)
  AUDIT_RETENTION_JOB_INTERVAL_MINUTES!: number;

  @IsInt()
  @Min(1)
  DEFAULT_MAX_UPLOAD_SIZE_BYTES!: number;

  @IsString()
  CLAMAV_HOST!: string;

  @IsInt()
  @Min(1)
  CLAMAV_PORT!: number;

  @IsOptional()
  @IsString()
  VIRUSTOTAL_API_KEY?: string;

  @IsOptional()
  @IsIn(['true', 'false'])
  DOCX_AI_HEADING_ENABLED?: 'true' | 'false';

  @IsOptional()
  @IsIn(['openai', 'ollama', 'rule-based'])
  DOCX_AI_HEADING_PROVIDER?: 'openai' | 'ollama' | 'rule-based';

  @IsOptional()
  @IsString()
  DOCX_AI_HEADING_BASE_URL?: string;

  @IsOptional()
  @IsString()
  DOCX_AI_HEADING_MODEL?: string;

  @IsOptional()
  @IsString()
  DOCX_AI_HEADING_API_KEY?: string;

  @IsOptional()
  @IsInt()
  @Min(1000)
  DOCX_AI_HEADING_TIMEOUT_MS?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  PARSE_WORKER_CONCURRENCY?: number;

  @IsOptional()
  @IsString()
  LIBREOFFICE_BINARY?: string;

  @IsOptional()
  @IsInt()
  @Min(1000)
  PDF_CONVERSION_TIMEOUT_MS?: number;

  @IsOptional()
  @IsString()
  SENTRY_DSN?: string;

  @IsOptional()
  @IsIn(['true', 'false'])
  CITATION_AI_ENABLED?: 'true' | 'false';

  @IsOptional()
  @IsIn(['openai', 'ollama'])
  CITATION_AI_PROVIDER?: 'openai' | 'ollama';

  @IsOptional()
  @IsString()
  CITATION_AI_BASE_URL?: string;

  @IsOptional()
  @IsString()
  CITATION_AI_MODEL?: string;

  @IsOptional()
  @IsString()
  CITATION_AI_API_KEY?: string;

  @IsOptional()
  @IsInt()
  @Min(1000)
  CITATION_AI_TIMEOUT_MS?: number;

  @IsIn(['minio', 's3'])
  STORAGE_PROVIDER!: 'minio' | 's3';

  @IsString()
  S3_REGION!: string;

  @IsString()
  MINIO_BUCKET!: string;

  @IsOptional()
  @IsString()
  S3_BUCKET?: string;

  @IsOptional()
  @IsUrl({ require_tld: false })
  MINIO_ENDPOINT?: string;

  @IsString()
  S3_ACCESS_KEY_ID!: string;

  @IsString()
  S3_SECRET_ACCESS_KEY!: string;

  @IsOptional()
  @IsString()
  QUEUE_PREFIX?: string;

  @IsOptional()
  @IsString()
  STRIPE_SECRET_KEY?: string;

  @IsOptional()
  @IsString()
  STRIPE_WEBHOOK_SECRET?: string;

  @IsOptional()
  @IsString()
  PAYPAL_CLIENT_ID?: string;

  @IsOptional()
  @IsString()
  PAYPAL_CLIENT_SECRET?: string;

  @IsOptional()
  @IsUrl({ require_tld: false })
  PAYPAL_BASE_URL?: string;

  @IsOptional()
  @IsString()
  PAYPAL_WEBHOOK_ID?: string;

  @IsOptional()
  @IsUrl({ require_tld: false })
  SHEERID_BASE_URL?: string;

  @IsOptional()
  @IsString()
  SHEERID_API_KEY?: string;

  @IsOptional()
  @IsString()
  SHEERID_PROGRAM_ID?: string;

  @IsOptional()
  @IsUrl({ require_tld: false })
  SHEERID_REDIRECT_BASE_URL?: string;

  @IsOptional()
  @IsString()
  SHEERID_WEBHOOK_SECRET?: string;

  @IsOptional()
  @IsIn(['', 'ipapi'])
  GEOIP_PROVIDER?: '' | 'ipapi';

  @IsOptional()
  @IsString()
  GOOGLE_CLIENT_ID?: string;

  @IsOptional()
  @IsString()
  GOOGLE_CLIENT_SECRET?: string;

  @IsOptional()
  @IsUrl({ require_tld: false })
  GOOGLE_CALLBACK_URL?: string;
}

export function validateEnvironment(config: Record<string, unknown>): EnvironmentVariables {
  const validatedConfig = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });

  const errors = validateSync(validatedConfig, {
    skipMissingProperties: false,
  });

  if (errors.length > 0) {
    throw new Error(errors.toString());
  }

  return validatedConfig;
}
