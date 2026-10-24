# Additional languages — 24 October 2026

Implemented for public and client areas: German (`de`), Italian (`it`), French (`fr`), Brazilian Portuguese (`pt-BR`) and Modern Standard Arabic (`ar`). Each catalogue contains all 1,094 English message keys with matching ICU arguments. The existing English, Dutch, Spanish and Russian catalogues remain available.

## Included

- Public home, Real Estate, Private Capital, introductory forms, login, neutral account/recovery/invitation pages, client dashboard, profile, reservations, Capital summary and project presentations.
- Locale allowlists, saved presentation preference, public paths, canonical/hreflang/sitemap metadata, nine-language selector and country-neutral Arabic label.
- Arabic document RTL, logical alignment/spacing/positioning, directional calendar/gallery/keyboard/swipe controls, LTR inputs for identifiers and unchanged photographs/logos.
- Client activation, project access and Capital access email copy for all languages. Rental request/confirmation/change/cancellation copy now includes Dutch, Spanish and all five new languages alongside Russian and English. Recipient selection, authorization, claims, delivery policy and cancellation/refund semantics are unchanged.
- Nine-language Supabase confirmation/recovery HTML is prepared in the `*-all-languages.html` files. These are **not installed**. They retain the exact repository baseline token URLs, use saved `preferred_language`, and preserve the original English fallback. A recovery request uses the account's saved preference, not an unauthenticated visitor's cookie.

## Validation and release boundary

Automated checks cover catalogue/ICU parity, plural categories, public versus protected/token route boundaries, saved preference allowlists, Capital denial before dossier reads, all localized mail snapshots/escaping/amounts and unchanged ownership/delivery checks. Browser fixtures use local synthetic auth/data only; they never mutate real accounts, bookings or send email. See PR validation for the executed results.

Preview branch `feature/additional-languages` uses the Staging Supabase project. Registration and email/invoice delivery are disabled there. Production has not been approved for these five languages.

Before final email completion: read/back up the actual Supabase Auth configuration; reconcile these prepared templates with the current live templates; configure and verify them in Staging, including approved controlled-inbox rendering and valid/expired/reused recovery/confirmation links. The available Supabase connector does not expose Auth configuration operations. Invitation/change-email/security notification templates must be inventoried against enabled flows before claiming all external email localization complete. Subjects also require supported template behavior to be checked in Staging; do not assume translated HTML means translated subjects.

Before Production: owner reviews the exact PR/Preview and gives explicit approval for that revision. Live external mail settings are a separate configuration change. No database migrations or changes to access policy are required by this PR. Native-speaker editorial review, especially Arabic, is recommended before treating copy as final.

Admin UI, uploaded PDFs/contracts and free-text database/editorial content are outside the translated catalogue scope.

## Executed acceptance checks (24 October 2026)

- 114/114 Node tests passed after final layout adjustment.
- Public browser fixture passed for all five new languages at 375, 768 and 1440px: home, Estates, Capital, login, SEO canonical, document direction, query/hash language switching, neutral account/token paths and forbidden localized private/admin/auth aliases.
- Five private project presentations passed in all nine languages at 375/1440px. Fixtures verify financial terms, restricted offerings, calendar minimum stay/overlap/amounts, exact booking API payloads, localized outcomes, galleries, unavailable calendar and denied project/offering access. All auth/data is synthetic and local.
- Arabic public/mobile and activation mail screenshots were visually inspected. Activation email HTML for all five new languages rendered without horizontal overflow at 375px. This does not establish email-client/inbox compatibility.
- Mobile German login no-wrap and long project text overflow were fixed; affected browser cases passed again.
- Optimized local build passed before the final CSS-only correction. The exact committed revision must also pass remote CI and Vercel build before release.
