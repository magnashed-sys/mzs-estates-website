# Lithuanian (lt) language — Staging rollout checklist · 26 October 2026

## Goal
Provide **Lietuvių** as the eleventh MZS Group platform language, matching the functional coverage of existing international languages without changing permissions, finance, booking records or security-sensitive URLs.

## Scope in this branch
- Public English-language source pages mapped to Lithuanian routes: `/lt`, `/lt/real-estate`, `/lt/private-capital`, `/lt/login`.
- 🇱🇹 language menu flag, Lithuanian SEO alternates/`lt_LT` Open Graph locale, sitemap and LTR typography.
- Registered client / partner interface, account requests, password recovery screens, My Profile and My Companies, private projects, booking interface, rental contracts and Private Capital user-facing text.
- Lithuanian consent, status/error text, plural forms, currency, dates, immutable references, navigation and accessibility labels (complete English message key structure is required).
- App-generated client activation, capital/project-access and booking request, confirmation, modification and cancellation emails have dedicated Lithuanian content.
- Standalone Lithuanian **Supabase Auth** signup and reset-password email HTML templates, preserving the exact verification and recovery token links for a separate, credentialed Auth configuration process.

## Absolute boundaries
- **No additional authorization or project visibility** is granted by the language preference. Member profile language is a presentation choice.
- No localized aliases for `/private`, `/admin`, `/api`, one-time token routes or authentication callbacks. Only known public routes get an `/lt` prefix.
- The administrative back office, user-entered notes, uploaded PDFs, binding legal documents and database-controlled project narratives are not automatically translated by this change.
- Supabase Auth configuration is **not automatically modified** by a code deployment. The standalone signup/recovery templates must be installed and separately tested before claiming fully localized Supabase Auth emails. The existing app-generated client notifications are covered.
- The source English catalogue and all existing language catalogues are preserved. None of the changes creates new mail triggers, alters invoice issuance or changes finance records.
- Lithuanian financial, legal, security and marketing translations should receive review by a native Lithuanian speaker before Production publication, even after complete key/ICU test coverage.
- No real emails or client account changes are performed by automated language tests.

## Verification
1. Review desktop/mobile `/lt`, `/lt/real-estate`, `/lt/private-capital`, `/lt/login`, including text sizing, Lithuanian diacritics and flag.
2. Verify the public root/login preference cookie, header and footer language switching, query/hash preservation and 11-language navigation without creating `/lt/admin` or `/lt/private`.
3. With a synthetic Staging client, select Lithuanian and refresh; verify Profile, Companies, My Reservations, contracts, private project presentations and Capital dossiers.
4. Trigger **no real mail**: use synthetic booking and account mail snapshots to verify requested versus confirmed wording, modification and cancellation warnings, 8-character password wording, CTA links, dates, Euro formatting and token placeholders.
5. Review a complete catalogue of **1,132 message keys**; ICU arguments must match English and all plurals must format at 0, 1, 2, 3, 11, 21, 100 and fractional counts.
6. Check SEO metadata and canonical/hreflang; Preview should not be indexed.
7. Require an explicit MZS Group owner approval before publication.

## Technical notes
- This branch is not a schema migration; it extends the existing next-intl catalogue, route allowlist and client preference handling.
- The app mail layers use `lib/mzs/localized-account-mail.ts` and `lib/mzs/rental-mail-copy.json`. Neutral Auth recovery/signup templates are prepared separately in `docs/mzs-*-lt.html`.

## Completion record — 26 October 2026
- The complete 1,132-key Lithuanian catalogue is present. ICU variables match English; Lithuanian integer/fractional plurals and account/booking mail safeguards are tested.
- The full local suite passes 194 tests. Next.js build and TypeScript validation passed, and GitHub Platform checks passed for the catalogue completion commit.
- The branch has a READY Vercel Preview, scoped to the MZS Staging public URL/key. App SMTP is disabled and rental mail uses capture mode for this preview.
- Browser checks confirmed Lithuanian home rendering, the flag, Dutch-to-Lithuanian language switching and preference persistence into the neutral `/request-access` route. Eight public/account routes also passed HTTP rendering checks with Lithuanian content. The final browser review caught and corrected the remaining Spain/UAE footer labels.
- Full authenticated client acceptance is still open: the preview readiness endpoint reports a missing required server configuration and cannot validate the privileged staging connection. No client-account or booking records were created or modified during verification. Do not treat public-page checks as an end-to-end client test.
- Mobile visual acceptance, native-speaker review and installation/delivery testing of the separate Supabase Auth templates remain release checks. No Production merge or release is included.
