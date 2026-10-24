# Russian member and project translation — Preview

Adds complete Russian Private, CapitalUI, MemberUI and ProjectUI catalogues (791 new messages, including nested status/document labels). Russian is selectable in the member menu and follows the existing account preference. Public paths remain `/ru/...`; private and one-time security routes retain their existing unprefixed URLs. Metadata remains presentation-only; no authorization policy, RLS, role, grant or database schema changes.

Russian client email: account activation, newly assigned project access, Private Capital access, rental request, booking confirmation, reservation changes and cancellations. Locale comes from the authenticated requester or actual booking/notification recipient. Administrator notifications retain English. Existing recipient validation, notification claiming and delivery controls remain in place. Requests explicitly remain unconfirmed; cancellations invalidate earlier confirmations and do not promise refunds.

## Verification

- 94 automated tests pass, including catalogue completeness, ICU argument parity, Russian plural counts, HTML escaping, booking status semantics, revoked-grant/Preview delivery denial and unsupported-language fallbacks.
- Optimized Next.js build and explicit TypeScript check pass.
- Capital page rendering and access-denial tests include Russian.
- Browser fixtures updated for the Russian member locale. Local Chromium cannot run in this execution environment; the complete browser/client journey and mobile layouts remain acceptance work.
- No real users, reservations or financial records were created and no emails sent during implementation.

## Preview isolation

Branch `feature/russian-member` uses the Staging Supabase public URL/key. Account creation, rental notification dispatch and invoice sending are disabled for the translation review. No service-role credential or SMTP credential is copied. Existing Staging accounts can review permitted projects; do not create live booking/invoice data for this review.

## Separate external authentication mail configuration

Prepared files `mzs-confirm-signup-email-template-ru-en.html` and `mzs-staging-reset-password-email-template-ru-en.html` select Russian using `.Data.preferred_language`, retaining the exact existing English fallback and token hrefs. They are **not installed** in Supabase. Supabase Auth configuration read/write is not exposed by the connected tool; do not claim otherwise. These repository templates are not deployed by Vercel.

Before configuring, retrieve the current Staging templates, compare their actual callbacks and preserve those exact links. Validate the Go template in Supabase, including absent/unknown preference; keep existing subjects unless separately verified. Test confirmation/recovery with valid, expired and reused tokens, same/different browser, query/hash and Preview/Production isolation using controlled test recipients. Inspect the currently configured invitation/email-change templates separately before preparing replacements. No Production Auth configuration changes are part of this PR.

## Remaining acceptance and release

- Staging browser review: RU profile/companies/reservations/Capital and all project presentations, desktop/mobile, switch RU ↔ EN/NL/ES, reload and logout/login with saved preference, preserve query/hash.
- Active client with access succeeds; inactive/signed-out users and missing project/offering/Capital grants are denied, including direct URLs/API calls. Admin remains admin; no localized private route aliases appear.
- Review Russian commercial terminology with a fluent speaker. Amounts, dates, rate conditions, minimum participation and provisional status must retain their original meaning.
- Controlled mail-inbox acceptance, including dark/light rendering, follows separate delivery setup. Offline rendering tests do not prove SMTP receipt.
- Existing uploaded documents, PDFs, leases/invoices, administrator UI and free-text database/editorial content remain in their original language. Titles/proper names are retained.
- Production release requires explicit approval of this version. This work creates a Preview only.
