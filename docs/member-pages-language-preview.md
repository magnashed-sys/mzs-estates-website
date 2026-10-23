# Member profile and reservation language — Preview

This slice extends EN/NL/ES to `/private/profile` (personal details, company relationships and security forms) and `/private/reservations` (booking statuses, dates, euro amounts, cancellation confirmation and history). It uses the existing authenticated account language. Project names, company names, entered addresses and cancellation reasons remain exactly as entered.

No schema, RPC, RLS, role, booking eligibility, email template or password-policy change is included. The existing profile password minimum remains eight characters; registration's separate policy is outside this translation change. No real credentials are used by the automated fixture.

Validation includes catalogue/ICU completeness, TypeScript, the Next.js build, and the local mock browser fixture `tests/browser/account-language.cjs`. The fixture checks all three languages, 375/1440px layouts, company/security tabs, locale-specific prices, profile saving and a single cancellation request with duplicate action suppression while pending. This does not substitute for a real Staging review.

Preview review: log in with the controlled Staging account, select a language in the overview and follow My Profile / My Reservations. Check the personal, companies and security sections and booking history. Do not change a real password or email as part of a translation review. Any cancellation action must use a designated Staging test booking.

The project presentations, property resources and rental booking calendars remain the next slice. Production publication requires owner acceptance of this Preview.
