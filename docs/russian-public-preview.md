# Russian public visitor journey

Scope: Russian (`ru`) marketing pages, login and neutral account screens; 303 translated catalogue entries. The brand slogan is translated in EN/NL/ES/RU on the homepage and both public section pages. Public URLs: `/ru`, `/ru/real-estate`, `/ru/private-capital`, `/ru/login`. Canonical/hreflang/sitemap and Open Graph use Russian equivalents. Longer Russian login heading can wrap on narrow devices.

The member portal still supports EN/NL/ES. A saved Russian preference resolves to English there; an existing supported account preference is retained. Member language menus do not offer Russian. Public account screens explain this boundary and that emails are not yet Russian. No security token URL aliases, access policies, database schema or email templates change. A direct localized landing persists its locale for neutral account screens. Switching languages retains query/hash.

## Validation

- 89 automated tests pass, including Russian catalogue completeness, ICU placeholders, public-route boundaries, member fallback and registration metadata/guard tests.
- Optimized Next.js build and TypeScript check passed.
- Local HTTP smoke checks passed for nine Russian public/account pages, invalid private/API/reset aliases and cookie redirects with query preservation.
- Added `tests/browser/russian-public.cjs`: isolated synthetic auth/contact fixture, desktop/tablet/mobile widths, query/hash, Cyrillic contact submission, inactive account rejection and private fallback. **Not executed successfully in this runtime:** browser launch is blocked by local Unix-socket permissions. Do not treat these browser assertions as passed.
- No real accounts created, mail sent or financial records changed.

## Preview setup and remaining acceptance

Only branch `feature/russian-public` is configured for the Staging Supabase public URL/key. Account creation is disabled for this presentation preview; rental mail is in preview mode and invoice sending disabled. No service credential was copied. Therefore actual contact persistence and account creation are not acceptance-tested here; review forms visually and use the isolated fixture for submission behaviour. Existing Staging test accounts can be used for an independently authorized login check.

Before release: visually review Russian typography on desktop/mobile, run the browser fixture in a suitable environment, and have Russian commercial copy (especially financing/security terms) reviewed. If a real Staging submission test is desired, configure a matching Staging-only service credential and controlled email delivery first. The owner explicitly approved Production publication after translating the slogan. Browser desktop inspection of the deployed Preview confirmed the Russian homepage and Capital page, plus language preservation from the homepage to registration; mobile and live form-submission acceptance remain outstanding.
