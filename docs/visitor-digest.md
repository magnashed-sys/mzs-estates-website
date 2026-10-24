# Daily visitor report

The owner requested daily visitor email, selected info@mzsestates.com, and changed dispatch from 23:30 to **00:00 Europe/Madrid**. Report covers the entire preceding local calendar day. DST boundary days correctly contain 23 or 25 hours.

## Scope

Authenticated active clients/partners: successful login events, public Home/Real Estate/Private Capital and private overview/profile/reservations/Capital/project pages. Project reporting repeats the current project and offering access checks. Admin logins are labelled separately; admin browsing is excluded. Page events are browser reports after 800ms visibility, not proof that someone read content. Existing sessions are included even without a new login. Individual files, gallery images, form content, query strings, hashes, IP addresses, user agents and passwords are not collected. Unsupported routes are excluded. No history is backfilled. Raw events are retained for 90 days; delivery metadata remains.

The report contains visitor name/email/role, login and page counts, first/last time per page. It uses the current profile name/email. Empty days produce a 'no registered activity' report. The first report is partial and states when collection started. Closing the browser quickly, blocking scripts or network failures can omit events; this is not a security audit trail.

## Security and delivery

API derives user/session from validated Supabase authentication, never the request body. Only active supported roles; project and offering permissions checked for project events. Same-origin POST, restricted path allowlist, deduplication by event ID/login session and 60 events/minute limit. All new tables use RLS, no anon/authenticated grants or policies, and service-role-only invoker functions. Existing rights and tables remain unchanged.

Single configured verified active admin recipient. Preview cannot send mail, even with SMTP credentials. Production/database pairing enforced. Existing SMTP_* / MZS_SMTP_* and CRON_SECRET settings are reused, with no new secret. Unique report-day claim precedes SMTP; duplicate workers cannot send twice. SMTP acceptance is not inbox delivery. Unknown delivery outcome or crash after claim needs manual review, never automatic resend. A pre-claim failure can be retried within the midnight hour. Vercel runs at 22:00 and 23:00 UTC; only the invocation corresponding to local midnight dispatches. This requires a Vercel plan allowing these schedules. No ChatGPT automation is created.

## Release

1. Apply `20261024210652_visitor_digest.sql` to the matching database; it defaults to disabled.
2. Set the configured recipient UUID after verifying current Auth email and active admin profile. Enable only on intended Production release; set started_at to activation time.
3. Publish tested code, verify exact domain/deployment SHA and Vercel cron availability. Keep existing cron entries.
4. Check first scheduled result in mzs_visitor_reports, then owner inbox. Do not report delivery confirmed solely from code/build/SMTP acceptance.

Disable using `update public.mzs_visitor_settings set enabled=false where singleton;`. Existing events remain; no account, permissions or booking mutation. Remove only the new cron entry on full rollback.

## Validation

Local automated checks cover DST/calendar windows, private DB privileges, disabled default, active accounts, login/event/report deduplication, HTML escaping, SMTP recipient checks, Preview denial, uncertain SMTP and DB acknowledgements, and cron authentication. Full existing suite and Next.js production build are run before release. Real mailbox receipt and live client browsing are separate post-release checks.
