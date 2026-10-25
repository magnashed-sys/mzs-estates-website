# Issuing entity business profiles

Admin Rental Contracts → Issuing entities now supports a company or private landlord, trade name, legal form, country, structured registered address, optional different billing address, contact person/email/telephone/website, account holder, IBAN, BIC, payment instructions, reply-to address and a PNG/JPEG logo (200 KB, 2000 px limit). Tax and registration numbers remain optional. Prefixes remain immutable with independent numbering.

Companies currently contains member-owned declarations, not an admin-controlled master registry. Explicit import copies name, trading name, registration and country and records the source company ID. No name-based matching, automatic synchronization or new permissions. The issuer is the authoritative admin-controlled billing profile. Deleting a source company clears its provenance link only.

## Compatibility and release
- Apply `20261025092439_issuer_business_profiles.sql` before deploying the UI. It is additive and preserves existing values.
- Staging database migration applied on 25 October 2026. A rolled-back authenticated-admin insert verified a private landlord with no tax/registration number.
- Draft contracts copy issuer details when saved. Existing active contracts are not backfilled. Their historical details stay unchanged; use the existing replacement-contract workflow when terms must change.
- Recurring drafts and issued invoices use the stored contract/draft snapshot. PDF and reply-to use that snapshot, never current company/issuer records.
- Default payment instructions do not alter payment dates. Sending still needs explicit approval; SMTP sender configuration stays unchanged.
- Production migration and publication have not been performed.

## Validation
- 129 automated tests pass, including additive migration preservation, private landlord validation, frozen profile through issue, stale-version conflict, denied client/inactive/anonymous access, malformed detail rejection and reply-to header injection.
- Next production build and typecheck pass using isolated Preview build configuration.
- Extended and legacy invoice PDFs generated; extended PDF text and rendering checked with synthetic data.
- Staging advisors show existing warnings on the pre-existing extension/auth/RPC configuration; no new public SECURITY DEFINER function or RLS policy was introduced.
- No real invoice emails sent. Browser acceptance still required: create/edit a company and private landlord, explicit Companies import, logo add/remove, reopen saved values, long addresses, mobile layout, and PDF review before issue.
