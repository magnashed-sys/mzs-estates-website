# Danish, Ukrainian, Finnish and Czech — 30 October 2026

Adds `da`, `uk`, `fi` and `cs` across the public website and private client/partner experience. Each catalogue contains all 1,160 English message paths, translated with matching ICU arguments. Ukrainian and Czech quantities include their native plural categories. Existing financial figures, property references and qualification text are retained.

## Language order

All public, inline/footer and account menus use the same ordered list:

English, Dutch, German, French, Spanish, Italian, Danish, Norwegian Bokmål, Swedish, Finnish, Czech, Polish, Lithuanian, Ukrainian, Romanian, Russian, Turkish, Simplified Chinese, Arabic, Brazilian Portuguese.

Codes: `en nl de fr es it da nb sv fi cs pl lt uk ro ru tr zh-CN ar pt-BR`.

## Coverage

- Public pages, introductory enquiries, login, registration, recovery, saved account preferences, profile/companies, reservations, rental contract/invoice overview and private-capital UI.
- Private project presentations, gallery captions, availability calendars, request states, property maps, site plans and video notes.
- About/careers, consultancy case studies, country labels, cookie consent, canonical/hreflang and Open Graph metadata, sitemap routes and visitor-path normalization.
- Application emails: account activation, project access, capital access, booking request, confirmation, modification and cancellation.

Private, admin, API and token URLs are not given language prefixes. Language metadata remains presentation-only. Admin/staff language policy, access grants, financial calculations and original legal/PDF documents are unchanged. No database migration is needed.

## Auth email templates: prepared for owner installation

Use the new consolidated review files:

- `mzs-confirm-signup-email-template-twenty-languages.html`
- `mzs-staging-reset-password-email-template-twenty-languages.html`

Both cover all 20 site languages with the established English fallback. They preserve the exact confirmation and recovery links. Standalone `-da`, `-uk`, `-fi`, `-cs` bodies are included; `-tr` also closes the prior Turkish gap in the combined Auth review package. Suggested translated subjects are in `four-language-mail-subjects.json`; subject-template execution is not asserted.

These repository files do not install Supabase Auth provider settings. As previously agreed, the owner publishes those settings manually after review. No real confirmation/recovery messages were sent for this change. Inbox delivery and provider-side subject rendering are not verified by local tests.

## Country-label consistency

Browser QA exposed different region names between Node and Chromium CLDR versions (for example Hong Kong labels). The four new locales now use committed, ordered country-name snapshots for both server and browser rendering. `scripts/generate-european-country-names.mjs` regenerates these deliberately for review. Telephone filtering and stored-country recognition are retained.

## Validation

Automated coverage includes message structure/ICU parity, native plural rendering, all twenty flag names and their exact order in public/inline/account menus, locale persistence, registration language metadata, protected-route exclusions, private-capital rendering/access guards, translated country roundtrips, email escaping and safe destinations, cancellation distinctions and unchanged Auth token links.

A native-speaker editorial review remains advisable for nuanced commercial and legal wording; automated tests validate completeness and formatting, not native editorial approval.
