# Rental change notifications — Staging review

Implemented on `feature/rental-admin-client-notifications`, based on main `79c77da` (PR #33). Production is not authorised. Draft PR: https://github.com/magnashed-sys/mzs-estates-website/pull/35

## Behaviour

An `AFTER UPDATE` trigger atomically queues a notification only for an active administrator changing the dates, guest count or quoted total of a confirmed live booking, or cancelling it. Approval of a client's cancellation request is included. Initial confirmation retains its existing route. Pending/test bookings, availability blocks, internal-note-only edits and no-ops do not create change messages. No historical backfill occurs.

The stored payload is an explicit allowlist: property, dates, guests and total. Neither internal notes nor cancellation reasons enter the email. English HTML and plain text use the existing charcoal/gold MZS identity, explicit text colours and private-reservation link. Cancellation states that the original confirmation and reservation are no longer valid. Refunds are separate.

The original admin mutation RPCs, validation, price calculation, availability exclusion constraint and admin audit are unchanged. The browser calls a same-origin admin API, which invokes the RPC with the authenticated user's session, then attempts dispatch. A sending failure does not reverse the booking change. The committed event survives a dropped browser request.

## Delivery and recovery

- Recipient identity/email is captured server-side from `auth.users`, then checked against the current booking owner and Auth email before dispatch. Browser-supplied recipient addresses are ignored. Address/ownership mismatches stop delivery for review.
- Atomic claims and a partial unique index permit one sender per booking. No-op repeats cannot enqueue a second event. Every event has a stable Message-ID; this alone does **not** make SMTP idempotent.
- New events supersede older unsent `pending`, `retry` or `failed` events. Sending and uncertain events retain their place; later events wait.
- Explicit SMTP 4xx non-acceptance is retried with backoff, at most five attempts. Permanent failures require review. Network loss with an unknown outcome is `uncertain`, not retried automatically. Nodemailer labels post-DATA socket loss as `CONN`, so that label is deliberately not treated as safe-to-retry.
- Failure to persist SMTP acceptance leaves the event claimed; after five minutes the next dispatcher marks it uncertain. No automatic resend follows. The operator must verify the event's Message-ID in SMTP logs and record a reason before resolving it. Resolution is audited.
- The admin panel shows recent delivery states and permits safe queue processing and explicit resolution. `accepted` means SMTP acceptance, not inbox delivery. Exactly-once delivery is not claimed.
- A dedicated Vercel daily recovery cron at `06:05 UTC` supplements immediate mutation dispatch, matching the existing daily-cron deployment pattern. It processes at most 20 due items within a bounded execution window. Manual queue processing is also available. Preview crons do not run automatically: test the protected dispatcher explicitly.

## Environment and release boundary

Preview must use `https://senonkpxdtlhyhrubicg.supabase.co`, `MZS_RENTAL_NOTIFICATIONS_ENABLED=true`, `MZS_RENTAL_MAIL_MODE=capture`, and a valid Preview deployment hostname. Capture uses Nodemailer's in-memory stream transport and cannot connect to SMTP even if SMTP credentials are inherited. Other application mail remains blocked by the branch-specific `MZS_SMTP_PORT=0`; registration is disabled on this branch.

Production mail requires all three: Production Vercel environment, the Production database URL, and explicit `smtp` mode plus the enable flag. No Production configuration, migration, merge or deployment was performed.

**Remaining blocker:** the branch-scoped `SUPABASE_SERVICE_ROLE_KEY` currently contains the disabled placeholder used in an earlier photo Preview. A valid key from **MZS Staging only** must be configured as a server secret for this feature branch, followed by redeployment. Do not paste it in chat, put it in source code or use a Production key. The Supabase connector can run SQL and provide public keys, but does not expose a server-key provisioning operation.

## Evidence and limits

- 41 automated tests passed, including real Nodemailer against a local SMTP stub: accepted mail, temporary rejection, permanent rejection and lost reply after DATA. Recipient/owner mismatch, disabled/crossed environments, privacy, retries and failed persistence are covered.
- `npm run build` and `npm run typecheck` passed. Build retains pre-existing CSS compatibility warnings outside this change.
- The additive migration was applied only to MZS Staging. `supabase/tests/rental_change_notifications.sql` passed there and in a minimal local PostgreSQL/PGlite rehearsal. Tests check repricing, unchanged audit, pending/notes-only/no-op suppression, cancellation, correct recipient, stale edits, anonymous/client/inactive-admin denial, exclusive claims, expired work, manual resolution and supersession. All fixtures are rolled back; zero QA users, outbox events and resolution rows remained after testing.
- Advisor findings on the two new tables are intentional: RLS enabled, no end-user policies, service-only grants. The explicitly authenticated resolution RPC is a security definer with an active-admin check and empty search path; anonymous access is revoked. Existing unrelated Staging advisor findings were not changed.
- Preview build `dpl_7k6gzsW3d2nd47vj8xH7pA37WQJB`, code commit `f84c67086618781857b0ee1b8e46850313a10638`, is READY: https://mzs-group-bzgvx7bxl-mzs3.vercel.app
- Full authenticated browser → API → Staging → captured email verification and visual acceptance are **not complete**, because of the server-key blocker. No real guest emails or external inbox-delivery test were performed.

## Resume after the Staging key is set

1. Redeploy this feature branch only; verify `/api/staging/readiness` accepts both Staging keys.
2. Create synthetic Staging admin/client and a future confirmed booking; never reuse actual client bookings.
3. Edit dates/guest count and verify the changed quote, unchanged nightly calculation, one audit row and one captured email to the synthetic client. Review desktop/mobile email appearance.
4. Repeat identical edits and notes-only edits: no new email. Exercise concurrent dispatch and verify one capture.
5. Cancel and verify invalidation language, released dates, retained booking/audit and no leaked reason.
6. Exercise recipient mismatch, a definite send rejection, ambiguous outcome and log-verified recovery. Check endpoint authorisation, origin protection and the cron secret.
7. Remove only the synthetic fixture records and accounts. Keep this PR Draft until acceptance is complete. Production requires separate explicit owner approval.
