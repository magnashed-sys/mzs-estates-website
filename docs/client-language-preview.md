# Client language rollout — first Preview

Scope: login (`/login`, `/nl/login`, `/es/login`) and the personal collection overview (`/private`), including its embedded Capital dossier summaries and request forms. Marketing pages keep the existing language behavior. No locale aliases are added for private, administrative, recovery or API routes. Login pages remain noindex and stay out of the public sitemap.

The authenticated user can save `preferred_language` (`en`, `nl`, `es`) using the globe in the personal overview. Supabase's existing `auth.updateUser({data: ...})` API updates only this presentation preference. It is never used for authorization; roles, active status, project grants and offering grants retain their existing checks. No schema migration, service-role access or new database grants are required. The server uses the validated account preference, then the public choice cookie, then English. Saving errors are visible and do not pretend the preference was persisted. The saved account preference takes precedence over the login page's display language after sign-in.

Login uses document navigation after the existing role checks to refresh the root HTML language. Existing password-recovery links use document navigation too. Password reset, request access, profile editing, reservations and project detail pages are not translated in this first slice. Their original content, permissions and processing remain unchanged. The private route language context is prepared to support those pages in the next slices. User-entered content, project names, documents and descriptions are not machine-translated. Administration and outgoing emails are outside this Preview.

## Validation

- `npm test` (54 existing/routing/catalogue tests).
- `npm run typecheck` and an optimized Next.js build.
- `MZS_PLAYWRIGHT_MODULE=/path/to/playwright node tests/browser/account-language.cjs` starts local Next.js and an in-memory auth/data fixture on ports 3090/3091. It uses synthetic credentials and never contacts real accounts. Covers EN/NL/ES login errors, mobile/desktop overflow, Dutch collection, preference update payload, persisted language in a second browser profile, visible save failure and inactive-account rejection.
- Review Preview login visually in all three languages.
- Before release, test sign-in and language persistence with an existing controlled Staging client/partner account. Do not use Production accounts in Preview or send test requests to existing administrators.

Production remains unchanged pending Preview review. Subsequent slices cover profile/reservation pages, rental calendars and project presentations; email language is a separate release decision.
