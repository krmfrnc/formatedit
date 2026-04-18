# Task 328 — Final QA Checklist

Run through this list before tagging a release. Every box is a pass/fail
gate — none of them are soft. If a gate fails, fix the underlying issue
rather than suppressing the check.

## 1. Build & static analysis

- [ ] `pnpm install` succeeds from a clean `node_modules`.
- [ ] `pnpm --filter @formatedit/api exec tsc --noEmit` is clean.
- [ ] `pnpm --filter @formatedit/web exec tsc --noEmit` is clean.
- [ ] `pnpm --filter @formatedit/api exec eslint .` reports 0 errors.
- [ ] `pnpm --filter @formatedit/web exec eslint .` reports 0 errors.
- [ ] Prisma: `pnpm prisma generate` matches committed schema.
- [ ] Prisma migrations apply cleanly on an empty database — no drift.

## 2. Unit & integration tests

- [ ] `pnpm --filter @formatedit/api exec jest` is green.
- [ ] `pnpm --filter @formatedit/web exec vitest run` is green (if present).
- [ ] `apps/web/e2e/` Playwright smoke suite runs green against a local
      deploy.

## 3. Manual happy-path smoke

- [ ] Register → verify email → log in.
- [ ] Upload DOCX → security scan passes → heading outline renders.
- [ ] Apply a template → download the formatted DOCX and generated PDF.
- [ ] Create a checkout session (Stripe test mode) → webhook marks the
      payment SUCCEEDED → invoice row created → `payment.succeeded`
      notification dispatched to the in-app bell.
- [ ] PayPal sandbox path repeats the same outcome.
- [ ] Student verification flow in SheerID sandbox → discount applied.

## 4. Admin panel

- [ ] ADMIN login sees every admin route; non-ADMIN gets 403.
- [ ] Feature flags: create, toggle, percentage rollout sticks per user.
- [ ] Announcements: publish/unpublish reflects in the in-app banner.
- [ ] Legal documents: new revision bumps version and users see the
      re-accept prompt.
- [ ] Analytics: MRR, ARR, churn, conversion cards render without errors.
- [ ] CSV report export downloads and opens in Excel with correct columns.
- [ ] Prometheus `/admin/metrics/prometheus` returns 200 with the
      0.0.4 text format.
- [ ] Coupons: create, expire, percentage and fixed — apply in checkout.

## 5. Support & affiliate (Batch 13)

- [ ] User creates a support ticket → admin sees it at
      `/admin/support/tickets` → reply round-trip works → close sticks.
- [ ] Out-of-hours auto-reply is emitted once and only once per ticket.
- [ ] WhatsApp + Telegram channel adapters successfully post a test
      message in sandbox credentials.
- [ ] Affiliate enroll → `/affiliate` shows the code → `/?ref=CODE`
      records a visit → signup binds the referral → payment creates
      PENDING reward → admin flips to PAID → payout report reflects it.
- [ ] Fraud cap: 4th signup from the same IP hash within 30 days is
      rejected (check API logs).

## 6. Legal & data rights

- [ ] `/cookies`, `/privacy`, `/terms`, `/kvkk`, `/gdpr` all render.
- [ ] Cookie banner appears on first visit; choice persists in
      `localStorage`.
- [ ] `/account/data` downloads a JSON dump of the user's data.
- [ ] Account deletion anonymises email, revokes refresh tokens, and
      writes an audit log entry.

## 7. Accessibility & dark mode

- [ ] `prefers-color-scheme: dark` renders the dark palette without
      unreadable contrast.
- [ ] Theme toggle round-trips: Light → Dark → System, each persisting.
- [ ] Run `pnpm --filter @formatedit/web exec axe` (or manual axe) on
      `/`, `/billing`, `/admin`, `/support`, `/affiliate`. No critical
      violations.

## 8. Performance & infrastructure

- [ ] API readiness endpoint returns 200 with Postgres + Redis up.
- [ ] BullMQ queues drain under load test (at least `formatting` and
      `notifications`).
- [ ] Socket.IO gateway accepts only valid JWTs; invalid tokens get
      disconnected.
- [ ] Grafana dashboard `ops/grafana/formatedit-overview.json`
      imports and shows live data.
- [ ] `docker-compose up` starts the full stack; `nginx.conf` proxies
      the SPA and API correctly.

## 9. Backups & restore dry-run

- [ ] Take a Postgres dump; restore it into a scratch database; confirm
      schema + row counts match.
- [ ] Take an S3 snapshot of the storage bucket; confirm a few random
      documents can be downloaded from the snapshot.

Sign-off requires: all boxes ticked, QA engineer name, date, git SHA.
