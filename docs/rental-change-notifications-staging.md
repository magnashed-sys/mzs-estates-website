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

**Credential blocker resolved on 23 October 2026:** the owner replaced the branch-scoped `SUPABASE_SERVICE_ROLE_KEY` in Vercel. A fresh Preview deployment accepts both Staging keys. The key remains a server-only Secret scoped exclusively to this feature branch's Preview environment; it was not copied into source code or chat.

## Evidence and limits

- 41 automated tests passed, including real Nodemailer against a local SMTP stub: accepted mail, temporary rejection, permanent rejection and lost reply after DATA. Recipient/owner mismatch, disabled/crossed environments, privacy, retries and failed persistence are covered.
- `npm run build` and `npm run typecheck` passed. Build retains pre-existing CSS compatibility warnings outside this change.
- The additive migration was applied only to MZS Staging. `supabase/tests/rental_change_notifications.sql` passed there and in a minimal local PostgreSQL/PGlite rehearsal. Tests check repricing, unchanged audit, pending/notes-only/no-op suppression, cancellation, correct recipient, stale edits, anonymous/client/inactive-admin denial, exclusive claims, expired work, manual resolution and supersession. All fixtures are rolled back; zero QA users, outbox events and resolution rows remained after testing.
- Advisor findings on the two new tables are intentional: RLS enabled, no end-user policies, service-only grants. The explicitly authenticated resolution RPC is a security definer with an active-admin check and empty search path; anonymous access is revoked. Existing unrelated Staging advisor findings were not changed.
- Verified Preview build `dpl_2jpWVv31vcKk2VT1mQ944rh98XSo`, commit `b42eeef62ba1e23f9cedbfd0f39f22e074915453`: https://mzs-group-64yyslukb-mzs3.vercel.app . `/api/staging/readiness` returned HTTP 200 with `isolatedStagingDatabase`, `publicKeyAccepted`, `serviceKeyAccepted` and `readyForIsolatedTesting` all true.
- Authenticated deployed API → Staging → captured email tests passed on 23 October 2026. Temporary admin, client and inactive-admin fixtures authenticated through Supabase Auth; no server key was copied out of Vercel. A disposable Vercel Sandbox ran the tests with network access restricted to this Preview and MZS Staging.
- A confirmed synthetic booking changed from seven nights/two guests/€2,100 to eight nights/four guests/€2,400, keeping its €300 nightly rate. The stored audit was retained. Exactly one update was captured for the actual Auth email; an injected browser recipient was ignored. Identical edits and notes-only edits created no extra mail; stale edits were rejected.
- Cancellation required a reason, retained the booking and audit, and released the occupied dates. Its captured email explicitly invalidated the earlier confirmation and omitted both the cancellation reason and internal notes. Repeated cancellation was rejected without another event.
- An intentionally mismatched synthetic recipient failed with `recipient_requires_review` and did not retry automatically. Recovery required verified logs and a reason. Two concurrent dispatch requests then returned exactly one `captured` and one `none`. An injected expired claim became `uncertain`, stayed unsent on repeated dispatch, and required explicit audited resolution. The saved booking change survived these failures.
- Anonymous users received HTTP 401; clients and inactive administrators received 403. Foreign-origin mutations were rejected with 403 and the cron endpoint rejected calls without its secret with 401. The scheduled invocation with the actual cron secret was not exercised.
- Captured HTML was visually reviewed in Chrome at desktop and 375-pixel iframe widths: readable light text, gold labels, current booking details, wrapping references and clear cancellation language. This is browser rendering of the exact captured HTML, not a test in external email clients.
- Cleanup confirmed zero remaining synthetic users, project, booking and outbox records. Resolution and booking-audit fixtures were removed before their parent records, and the disposable Sandbox was stopped.
- Remaining acceptance: owner review of the dashboard interaction and email appearance. The signed-in dashboard click flow was not automated; the actual deployed endpoints were exercised with authenticated sessions. No real guest emails or external inbox-delivery test were performed. SMTP failure classifications remain covered by the local Nodemailer integration tests.

## Owner acceptance in Preview

1. Open the verified Preview and sign in with a Staging administrator account.
2. In Bookings, use only a fictitious future confirmed Staging reservation. Records marked `is_test=true` intentionally do not generate client notifications.
3. Edit dates or guest count. Expand **Client notification status** and open **Preview email** to review the captured message and intended recipient. Capture mode does not deliver to an inbox.
4. Change only internal notes, then cancel with a reason. Verify that the notes-only edit adds no email and the cancellation preview clearly invalidates the reservation without exposing the reason.
5. Keep this PR Draft until owner acceptance is complete. Production requires separate explicit approval, followed by its migration/environment configuration and a controlled delivery check.
