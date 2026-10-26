# Lithuanian (`lt`) language rollout — Work in progress

## Target
Introduce Lithuanian as the eleventh supported language for the MZS Group public site and authenticated member interfaces. Follow the Turkish (`tr`) implementation without introducing any route alias, access-control changes, or financial side effects.

## Translation coverage required before staging acceptance
- 1,132 exact existing English catalogue entries in `messages/en.json`, including ICU interpolation variables, plural categories, investment/project presentations, member/partner workflows, account recovery and public pages.
- `lt` public routes: `/lt`, `/lt/real-estate`, `/lt/private-capital`, `/lt/login`; locale-aware titles, hreflang and sitemap, and Lithuanian 🇱🇹 language menu choice.
- Preference cookie and member metadata, neutral reset/verification forms, private dashboard, company data, capital overview, booking calendar, project galleries and notices.
- Client notifications for account activation, new project access and Capital access. Booking-request, confirmation, modification and cancellation mail.
- Protect auth tokens, admin URLs, database content, user-supplied notes, contracts, private attachments, and permission checks. No automatic translation of user data.

## Progress on this WIP branch
- ✅ Lithuanian draft of all booking email event texts added to `lib/mzs/rental-mail-copy.json`.
- ✅ Lithuanian draft of account activation, project assignment, and Capital-access emails added to `lib/mzs/localized-account-mail.ts`.
- ☐ `messages/lt.json` 1,132 translations: not ready; do not enable the route or send account email with a Lithuanian preference until this is reviewed.
- ☐ Locale routing/UI flags/metadata and remaining locale-specific tests.
- ☐ Editorial review by a native Lithuanian speaker, especially terms relating to contractual commitments, financing, personal guarantees and interest.
- ☐ Staging build, secure functional testing and owner approval.

## Quality gates
Translation parity and ICU variable preservation are mandatory, including at least `{count}`, `{price}`, `{bedrooms}` and `{bathrooms}`. The public multilingual test suite must cover all 11 locales with translated data and plural renderings. Ensure account registration and client-specific email locale allowlists match routing. Retain existing role and status validations.

## Third-party translation service
The initial external translation endpoint returned HTTP 429. We do not silently substitute English copy for unreviewed Lithuanian strings or claim that the 1,132-text catalogue is fully translated. This branch is deliberately not ready for Production.

## Supabase authentication templates
Supabase Auth server-side confirmation/recovery emails require a distinct controlled template review. Translated in-app recovery pages alone do not change those server-managed emails.
