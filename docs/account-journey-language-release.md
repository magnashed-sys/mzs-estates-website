# Account journey and client notification languages

Release scope: English, Dutch and Spanish account request, registration pending, forgotten password, password reset, invitation acceptance and the surrounding private Capital overview. The five public account routes remain language-neutral URLs, using the explicit MZS_LOCALE preference. The globe reloads neutral routes without losing query strings or fragments. Public login links retain their localized destination.

Registration records an allowlisted preferred_language in Auth user metadata. This is presentation data only: existing profile activation, invitation/recovery proofs, duplicate checks, rate limits, email confirmation and all project/Capital authorization checks remain authoritative. Known registration errors are translated, including partial-created warnings that tell clients not to register twice; unexpected backend details are replaced by a generic localized message.

Three existing outbox events follow the recipient's saved preference: account_activated, new_project_access and capital_access_granted. The preference is fetched by the server using the existing verified recipient ID. Missing, invalid or unavailable preferences retain the existing English template. Administrators' notification templates remain English. Claiming, recipient eligibility, access revision verification, SMTP acknowledgement, queue state and retry behavior are retained. Capital emails still contain only a generic secure link, never dossier amounts or project details.

## Validation

- 65 automated tests pass, including complete translation catalogues/ICU messages, registration metadata allowlisting, registration safeguards, localized mail delivery with mocked SMTP, escaped names, English fallback, revoked access, Preview restrictions, and Capital page authorization/empty/error states.
- TypeScript check and optimized Next.js build pass (only existing CSS autoprefixer warnings).
- `tests/browser/account-journey-language.cjs` passes all three languages: registration success and partial-created error, pending review, generic password recovery, invalid and valid recovery proof, password mismatch, completed reset, verified invitation and activation, exact existing RPC contracts, desktop and 375px layouts, and language switching preserving query/hash. All Auth/data operations are local in-memory fixtures and all addresses use example.invalid.
- Six Dutch/Spanish client mail variants render without horizontal overflow at 375px and desktop; mobile rendering visually reviewed. SMTP acceptance is simulated, not a new external inbox delivery test.
- Local browser fixture uses one localhost origin: Next dev redirects from 127.0.0.1 to localhost otherwise split test cookies. This fixture issue required no production security change.

No database migration, environment variable change, production account creation, password change, permission change, reservation change or live test mailing is required for this release. Existing rental confirmation and change/cancellation mail implementations are untouched.

## Separate remaining localization work

Supabase-managed security email templates (confirmation, invitation and recovery) are configured independently from application outbox mail. They are not changed by this release and need their own provider configuration and controlled recipient/link verification. Original uploaded documents and individually entered project/editorial content retain their source language. This release does not claim that every email/document is translated.

Rollback: revert this application release and redeploy main. There is no schema rollback. Stored preferred_language is optional presentation metadata and remains backward compatible.
