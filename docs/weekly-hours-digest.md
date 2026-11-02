# Weekly submitted-hours email

Replaces ChatGPT automation `6ae7bafd67a08191816e85462ac64c12` (Gmail) with the same Vercel cron + existing SMTP_* / MZS_SMTP_* delivery approach as the visitor digest. Recipient is exclusively the owner-authorized `magdy@mzsgroup.eu`; the configured profile must be active and match a confirmed Auth email. This mailbox belongs to the owner's client account: email receipt does not grant admin access. Review links continue to require a separate authorized admin session.

Monday 07:00 Europe/Madrid. Vercel invokes at 05:00 and 06:00 UTC; the local clock gate admits only 07:00. Previous Monday inclusive through current Monday exclusive, selected by `created_at`, not work date. Work dates, late submissions, original/effective minutes, current review decisions and pending corrections are shown. No billing rounding. All staff and work areas, including Zorgbalans, are included. Per-person links select the actual work week. Empty periods send an explicit zero report; query errors never become zero.

The service-only invoker RPC reads a single database snapshot and returns a JSON scalar, avoiding REST pagination truncation. It reads the same underlying visits/corrections/reviews as the current-visits view; the user-scoped review view cannot be used by the scheduler. A 10,000-entry ceiling fails closed. Added service-role grants are SELECT-only on necessary source columns; no member rights or operational records are changed. Settings and send ledger have RLS and no client grants. Atomic week claim prevents concurrent/double sends. Ambiguous SMTP or DB acknowledgement requires investigation, never automatic resend.

## Cutover

Apply migration on staging and verify worker execution and denied anon/member access. Run unit/database/delivery tests, full suite, typecheck and build. Deploy staging-backed preview. Apply migration to production (disabled by default), reconcile the snapshot against existing current-visits data, configure verified recipient and first_week=2026-11-02. Record 2026-10-26 as sent_via_gmail: user confirmed receipt on 2 November. Preserve all existing cron entries and SMTP settings. Release exact tested code, keep production pilot release SHA aligned. After READY and route verification, enable platform settings and pause the Gmail automation. First new scheduled report: 9 November 2026 at 07:00 Madrid.

No immediate resend is needed. SMTP acceptance is not proof of inbox receipt. For rollback disable mzs_weekly_hours_settings before resuming Gmail; reconcile the weekly ledger first. The additive schema may remain. Prior deployment: dpl_EAs2B49Nf6jwLSLXgKTse78z5Fmh (ca4fcd8cde403dcadb944ef48f76b15407573cf6).

Owner follow-up: visitor digest also becomes weekly, Monday 07:00 Madrid, previous full week. Its existing ledger uses the Sunday period-end key; historical daily entries remain unchanged. Recipient remains its existing configured admin. Both report cron entries use 0 5,6 * * 1.
