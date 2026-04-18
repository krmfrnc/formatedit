# FormatEdit

Academic document formatting and analysis SaaS platform.

This repository currently contains the Batch 1 foundation:
- Next.js web application
- NestJS API
- Prisma schema baseline
- Redis and BullMQ foundation
- S3/MinIO storage abstraction
- Health endpoint and request tracing

## Workspace Layout

```text
apps/
  api/      NestJS backend
  web/      Next.js frontend
packages/
  shared/   Shared types
prisma/     Prisma schema
```

## Requirements

- Node.js 22+
- pnpm 10+
- Docker Desktop or compatible Docker runtime

## Setup

1. Install dependencies:

```bash
npx pnpm install
```

2. Copy environment values:

```bash
cp .env.example .env
```

3. Generate Prisma client:

```bash
npx prisma generate
```

4. Start local infrastructure and apps:

```bash
docker compose up --build
```

## Common Commands

```bash
npx pnpm dev
npx pnpm build
npx pnpm lint
npx pnpm typecheck
npx pnpm test
```

## Current API Foundation

The API bootstrap currently includes:
- global validation pipe
- global exception filter
- request ID middleware
- centralized module loader registry
- queue module
- storage module
- health module

## Health Endpoint

```text
GET /health
```

Returns a lightweight readiness snapshot for:
- api
- database client wiring
- redis client wiring
- registered queues
- storage provider configuration

## Notes

- Prisma is the selected ORM.
- MinIO is the default local storage provider.
- AI features are intentionally not wired yet.
- Queue workers are scaffolded but not yet connected to document jobs.
