# Task 330 — Launch Checklist

The go/no-go list for the public launch. Work top-to-bottom — each
section blocks the next. Owner column is filled in during the launch
war-room; don't ship without assigned owners.

## T−7 days

- [ ] QA checklist (`docs/qa-checklist.md`) fully green on `staging`.
- [ ] Load test: 100 concurrent checkout flows sustained for 10 minutes
      without p95 latency exceeding 1 s.
- [ ] Third-party credentials rotated to live keys (Stripe, PayPal,
      Resend, WhatsApp, Telegram, SheerID).
- [ ] Legal documents (`/terms`, `/privacy`, `/kvkk`, `/gdpr`,
      `/cookies`) reviewed by counsel and versioned in
      `legal_documents` with the final text.
- [ ] DNS for the production apex and www subdomain points at the edge
      load balancer; TTL dropped to 300 s for the cutover window.
- [ ] TLS certificate issued and deployed; OCSP stapling confirmed.

## T−3 days

- [ ] Backups verified: restore `pg_dump` into scratch database, sample
      storage object.
- [ ] On-call rota published; PagerDuty integration tested end-to-end.
- [ ] Grafana dashboard imported; alerts wired for 5xx rate, queue
      depth, payment-webhook failure rate.
- [ ] Launch announcement email drafted and queued in Resend.
- [ ] Admin seed data uploaded: official templates, initial coupons,
      feature flags in their default state.

## T−1 day

- [ ] Freeze: no non-critical merges to `main`.
- [ ] Final smoke on `staging` — full happy path, including affiliate
      enroll → payment → reward lifecycle.
- [ ] Rollback plan written: previous image tag noted, database
      migration down-script dry-run on a scratch database.
- [ ] Support team briefed; WhatsApp + Telegram support channels
      connected to the right inbox.

## Launch day — T−0

- [ ] Deploy the release tag to production.
- [ ] Run post-deploy migration and confirm no drift.
- [ ] Confirm readiness: `/health/ready` returns 200; Socket.IO
      handshake works with a real JWT.
- [ ] End-to-end smoke in production with a real test account: signup,
      upload, format, pay (smallest possible amount), refund.
- [ ] Launch announcement sent.
- [ ] DNS cutover (if applicable) and TTL restored.

## T+1 hour

- [ ] Error rate < 0.5% across API and web.
- [ ] All BullMQ queues at < 100 pending jobs.
- [ ] No unhandled payment webhooks.
- [ ] First real customer signup observed in audit log.

## T+24 hours

- [ ] Review: error budget burn, signup funnel, checkout conversion,
      first affiliate rewards.
- [ ] Post-launch retrospective scheduled.
- [ ] Any Sev-2 items from the first day have tickets filed.

## Rollback criteria

Trigger rollback immediately if:

- Error rate > 2% for > 5 minutes.
- Payment webhook backlog > 500 unprocessed events.
- Any data-integrity alarm (duplicate accounts, duplicate rewards,
  invoice numbering gap).

Rollback steps:

1. Re-deploy the previous image tag.
2. Restore the pre-launch database snapshot only if schema is
   incompatible — prefer fast-forward fixes otherwise.
3. Announce downtime window on status page if rollback exceeds 15
   minutes.

## Sign-off

Required sign-off before declaring launched:

- Engineering lead
- QA lead
- Support lead
- Operations / SRE lead

File the signed-off copy in the launch-war-room channel and archive it
in `docs/launch/`.
