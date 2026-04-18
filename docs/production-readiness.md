# Task 329 — Production Readiness

A snapshot of what the platform needs to run in production, not a
tutorial. Treat this as the contract between the application and the
infrastructure team.

## Required environment variables

### API (`apps/api`)

| Key | Notes |
| --- | --- |
| `DATABASE_URL` | Postgres 15+, `sslmode=require` in production. |
| `REDIS_URL` | Redis 7 for BullMQ and rate limiting. |
| `JWT_SECRET` | 64+ random bytes (base64). Rotate via deploy with grace period. |
| `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` | Live keys. |
| `PAYPAL_CLIENT_ID` / `PAYPAL_CLIENT_SECRET` / `PAYPAL_WEBHOOK_ID` | Live. |
| `SHEERID_PROGRAM_ID` / `SHEERID_ACCESS_TOKEN` | Student verification. |
| `RESEND_API_KEY` | Transactional email. |
| `WHATSAPP_PHONE_NUMBER_ID` / `WHATSAPP_ACCESS_TOKEN` | Meta Cloud API. |
| `TELEGRAM_BOT_TOKEN` | For both notifications and support channel. |
| `S3_ENDPOINT` / `S3_BUCKET` / `S3_ACCESS_KEY` / `S3_SECRET_KEY` | Document storage. |
| `MAXMIND_GEOIP_DB_PATH` | Mounted at `/opt/geoip/GeoLite2-Country.mmdb`. |
| `APP_URL` | Public origin (used in email templates and share links). |

### Web (`apps/web`)

| Key | Notes |
| --- | --- |
| `NEXT_PUBLIC_API_URL` | Public API origin. |
| `NEXT_PUBLIC_APP_URL` | Public app origin. |

## External services

- **Postgres** — primary store. Daily `pg_dump` to S3 with 30-day retention.
- **Redis** — queues + transient auth cache. No durable data; restart OK.
- **S3 / MinIO** — uploaded DOCX, generated DOCX/PDF, invoice artefacts.
  Lifecycle rule: user-uploaded `scratch/` older than 7 days is cleaned.
- **Stripe + PayPal** — payments. Webhook endpoints must be publicly
  reachable at `/payments/webhook/stripe` and `/payments/webhook/paypal`.
- **Resend** — SMTP alternative for transactional mail.
- **Meta Cloud + Telegram** — WhatsApp and Telegram messaging.
- **SheerID** — student verification.
- **MaxMind GeoLite2** — multi-currency at checkout.

## Runtime topology

- `nginx` edge reverse proxy (see `nginx.conf`): terminates TLS, fronts
  the Next.js container and the NestJS container, streams Socket.IO.
- 1 API container (scale horizontally behind Redis-backed queue and
  session-less JWT auth — no sticky sessions required).
- 1 Next.js container (SSR); scale horizontally.
- 1 worker container running the BullMQ consumers (`formatting`,
  `notifications`). The same image as the API with a different entry
  command.
- Redis + Postgres as managed services recommended.

## Security

- TLS 1.2+ at the edge, HSTS preload.
- API rate limiting: 100 req/min per IP, bypass for internal admin IPs.
- Security headers set by `nginx` (CSP, X-Frame-Options, Referrer-
  Policy). CSP allows only self, Stripe, PayPal, and the configured S3
  origin.
- Secrets stored in the cloud provider's secret manager, never in git.
  CI reads them into the deploy environment.
- Admin accounts require SSO (Google OAuth) where possible. Admin
  impersonation writes an audit log on both start and end.
- Document uploads are scanned (see `DocumentSecurityService`) before
  being made available to parsers.

## Observability

- `/health/ready` and `/health/live` return JSON status. Alert on
  consecutive failures.
- `/admin/metrics/prometheus` exposes the custom metrics; scrape every
  15 s.
- `ops/grafana/formatedit-overview.json` is the default dashboard.
- Application logs go to stdout in JSON format; the infrastructure team
  ships them to the central log store.

## Backups

- Postgres: `pg_dump` daily, 30-day retention, restore drill every
  month.
- S3: versioning ON; lifecycle rule keeps the last 30 versions.
- Redis: no backup needed (transient state).

## Incident runbook pointers

- Stripe webhook failures: check `payment_webhook_events` table for
  `FAILED` rows; retry via `POST /admin/payments/webhooks/:id/replay`.
- Notifications stuck: inspect the `notifications` queue via
  `bullmq-board` (dev) or the BullMQ admin endpoints.
- Admin impersonation leak: revoke via `DELETE
  /admin/impersonations/:id` and invalidate the admin's refresh tokens.

## Dependencies pinned in CI

- Node 20 LTS.
- pnpm 9.
- Postgres 15.
- Redis 7.

Anything newer must be tested in staging first.
