# Public analytics — G-JY9NR8LHLE

Google's gtag.js integration is added once, after explicit analytics consent. Production host allowlist only; previews never send to this property. Sixteen translated consent prompts offer accept/reject with equal presentation and a persistent settings control. The choice expires after 180 days. Rejecting after activation disables collection, clears standard GA cookies and reloads to unload the tag. Links into private/account recovery areas perform a document navigation when analytics is active; route changes additionally disable collection outside the allowlist.

Manual `page_view` for the five marketing pages in all 16 locales and `/request-access`. No login, recovery, admin, private project, booking or token pages. `generate_lead` is emitted after API-confirmed success with `lead_type` of `intro_call` or `account_request`. No names, email, phone, messages, reference IDs or account IDs. URLs and referrers exclude queries and fragments. Campaign parameters are deliberately not forwarded yet: define approved campaign identifiers before launching campaign reporting. Vercel public pageviews remain available alongside GA4.

## Google property settings required before production activation

In Admin → Data streams → Web → Enhanced measurement, disable automatic enhanced measurement (especially browser-history page views, form interactions, downloads and outbound clicks). This integration supplies manual page views and success events; server-side stream settings cannot be guaranteed from website source. Keep Google Signals and advertising personalisation off; client config also disables them. Mark `generate_lead` as a key event; optionally register `lead_type` as an event-scoped custom dimension. Confirm the property's reporting timezone, retention and internal-traffic filter with the owner. Do not paste a second copy of the Google snippet into a layout or Tag Manager.

## Verification

Unit tests simulate consent, preview exclusion, all localized routes, private exclusion, URL cleaning, page deduplication and withdrawal. CI also runs the complete project test suite, production build and TypeScript checks. Before releasing, review banner on desktop/mobile, reject: no Google requests, accept: one page_view per navigation, withdraw: no subsequent collection. Use a controlled test environment/mock endpoint for forms, not real customer requests. After activation confirm actual receipt in GA Realtime/DebugView (requires account access). This file does not claim receipt has been verified.

Sources: https://developers.google.com/tag-platform/security/guides/consent?consentmode=basic ; https://developers.google.com/analytics/devguides/collection/ga4/views ; https://support.google.com/analytics/answer/9216061
