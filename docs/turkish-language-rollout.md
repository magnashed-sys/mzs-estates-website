# Turkish (tr) language rollout — 26 October 2026

This change introduces Turkish to the existing MZS Group language system, without altering account permissions, financial calculations, database schemas or security-sensitive routes.

## Scope
- Public Home, Real Estate, Private Capital, introduction request, login and localized SEO routes (`/tr`, `/tr/real-estate`, `/tr/private-capital`, `/tr/login`).
- Language flag 🇹🇷 and accessible Türkçe option on desktop, mobile and footer, while preserving all nine existing choices.
- Client/partner account language preference, neutral recovery and registration pages, profiles, companies, reservation and private-capital overviews, and translated private project galleries, booking requests and captions.
- A complete Turkish message catalogue with all 1,132 English message paths, including nested statuses and document categories. Dynamic amounts, dates, names and ICU message arguments are retained.
- Turkish client-facing account activation, project-access and capital-access emails; Turkish booking request, confirmation, modification and cancellation copy.
- Search/SEO metadata, language alternates and sitemap expansion. Turkish is left-to-right; only Arabic remains right-to-left.

## Deliberate boundaries
- No translated aliases for `/admin`, `/private`, `/api` or one-time account token routes. Private pages retain their existing canonical URLs while rendering the chosen language.
- The admin cockpit, user-written notes, uploaded PDF documents, legal agreements and database-managed project/editorial data are not machine-translated.
- Supabase Auth's email confirmation, password recovery and security notification **server templates** are not changed by this GitHub change. The app's recovery screens are translated; external authentication templates require separate Supabase configuration inspection and validation before installation.
- No real mail is sent or account changed by language tests; translations have no role in authorization.
- Editorial/native Turkish review of financial/legal investment language is recommended before publication.

## Acceptance
1. View `/tr`, `/tr/real-estate`, `/tr/private-capital`, `/tr/login` on desktop and mobile; verify ten flags and document `lang="tr"`, `dir="ltr"`.
2. Switch between Turkish and an existing language, preserve query/hash and return routes; check cookie preference on neutral root/login.
3. Sign in with a **Staging** client/partner test account, select Turkish, refresh and visit My Profile, My Companies, My Reservations, Private Capital and permitted project pages. Check security/password text and date/amount formatting.
4. Confirm that Turkish does **not** create access to new projects or protected route aliases, and that the original account invitation/recovery URLs remain unchanged.
5. Verify mail snapshots using only synthetic fixture data, and review real-mail templates separately.

Production requires explicit owner acceptance after CI/build and Preview checks.
