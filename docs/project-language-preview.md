# Project presentations and rental calendars — Preview

Extends the existing authenticated EN/NL/ES account language to the five private project presentations: Villa La Nucia, Marina Botafoch Apartment, Villa Can Juan Ibiza, Villa des Coloms Ibiza and Amsterdam Floraweg. Includes static project narratives, documented terms, photo captions and galleries, milestones, document controls, and both rental calendars.

Calendar display dates, weekday/month labels, euro amounts, plural counts, validation and request results follow the account language. ISO date keys, Europe/Madrid day boundaries, pricing arithmetic, minimum stays, unavailable periods, configuration IDs and booking API payloads remain unchanged. The villa calendar's obsolete “Test mode only” label is replaced with the existing approval-pending explanation. Its minimum-stay error now displays the configured minimum rather than a hardcoded one night.

The project layout serializes only the client-component message allowlist; server-only project and loan narratives remain behind page access checks. Catalogue tests enforce this boundary.

Project/offering grants, active-account checks, document RLS and 60-second signed links remain unchanged. Editorial content and document names/descriptions/bodies stay as supplied. No schema migration, environment-variable change, email-template change or notification dispatch is included. Financial amounts, limitations and proposed terms are retained; translation does not constitute a new offer.

Validation: `npm test`, `npm run typecheck`, `npm run build`, and `tests/browser/project-language.cjs`. The browser fixture uses only local mocked authentication, database responses and intercepted booking requests. It covers all five projects in three languages at 375/1440px, preserved financing terms, restricted offerings, minimum stays, blocked periods, locale prices, exact booking payloads, failures/success and gallery controls. Denied project or offering grants must return 404. No real bookings or emails are created by this fixture.

Preview uses the existing isolated Staging branch configuration. Review with the controlled Staging account: select the desired language on the private overview, open an assigned project, inspect the narrative/gallery, and select dates in the rental calendar. A submission is unnecessary for translation acceptance. Production publication follows acceptance of this slice.
