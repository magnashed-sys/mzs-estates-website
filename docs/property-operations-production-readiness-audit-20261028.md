# MZS Group — Property Operations Phase 1
## Release readiness and integrated acceptance review
**Inspection:** 28 October 2026 · **Environment:** isolated MZS Staging / Draft PR #143 · **Recommendation: NO-GO for Production yet.**

### Grounded observations

- Development branch `feature/property-operations-accountancy-foundation-20261028`, PR #143, remains **DRAFT, OPEN, not merged**.
- Preview of reviewed head before this audit: `https://mzs-group-f9u8y8aml-mzs3.vercel.app` (commit `6d4d02bea4c53fc404addc9cc6e3ef83ee84f89e`) was `READY`.
- Production Supabase **currently has zero `mzs_ops_` public tables**. Staging has 19 protected `mzs_ops_` tables and two narrowly scoped directory views.
- All 19 Staging `mzs_ops_` tables show RLS enabled. No anon SELECT, and no authenticated direct UPDATE/DELETE privileges. The directory views are `security_invoker=true`; employees are limited to explicitly assigned physical properties, not tenant/owner finance data.
- Staging Security Advisor reported **no active findings specific to `mzs_ops_`** on the inspected head. Other legacy system findings may still exist; do not claim project-wide clean security.
- Staging Performance Advisor reported **25 unindexed FK info findings** among these new operational tables. Additive covering indexes prepared in `supabase/migrations/20261028194500_mzs_ops_fk_indexes_staging.sql` (must validate before staging application).
- Vercel preview unauthenticated GET to `/staff`, `/admin/workspaces/estates/staff` and `/admin/workspaces/estates/expenses` returned the login experience rather than private administration.
- Unauthenticated request to the new `/api/admin/property-operations-costs` previously returned **503** rather than allowing the authentication redirect / notFound to propagate. No private totals were returned. Corrected in commit following the reviewed head by moving `requireEstateAdmin()` outside the financial-source catch; re-verify on the new Preview.
- No grouped preview runtime errors were found for the previous three-hour interval, but logs being empty is **not** a substitute for authenticated browser acceptance.

### Verified unit/database integration

The GitHub test suite plus rollback-only Staging PostgreSQL checks have covered:
- Private and property-scoped visit/time entry, maintenance tickets and photographs; no unrelated user's or property’s data.
- Explicit grant/revoke with immediate loss of staff visibility on revocation.
- Immutable visit originals and manager-only correction decisions; candidate billable minutes separate from real minutes.
- Maintenance status/event sequencing; internal draft work orders tied to verified entity-payer and source supplier; manager-only budget authorization.
- Supplier expense original/evidence, review, corrections/replacements and partial accountant archive hashes/exception files.
- Financial cockpit operating costs by invoice date versus actual recorded cash; no automatic subtraction from rent/interest net cashflow.
- All synthetic Staging insertions have been performed in rolled-back transactions; Production Catherine profile and past WhatsApp costs are **not** copied, changed, or re-invoiced.

### Production blockers — required before merge/deploy

1. **Authenticated end-to-end user acceptance is still absent.** Test as Group Admin and a separately designated Staging client/partner, on mobile and desktop, with screenshots or verified reproduction of login → grant → visit → correction → approve → upload ticket image → work order → internal authorization → source downloads → accountant ZIP. Test token expiration and incorrect entitlement.
2. **Staging-only code MUST NOT be blindly promoted.** Many server actions/routes explicitly require `VERCEL_ENV='preview'` and the Staging Supabase URL. A production branch merge without an intentional audited environment-aware authorization/release design would create unusable Production features. Never change the URL to point Production at Staging.
3. **Production migration readiness:** explicit reviewed ordered migrations, backup/rollback procedure, initial grants disabled, careful grants for existing legal entities and suppliers; destructive or cross-environment writes forbidden. Existing Customer/Booking/Capital workflows must be retested.
4. **Photo privacy and content scanning:** no malware scanner, EXIF/geo metadata scrub, sensitive content policy, retention or consent flow yet. For Production employee photos, decide these first and test private Storage object expiry and image reuse.
5. **Staff corrections after prior approval:** immutable correction-before-approval exists. Already-approved erroneous time entries still lack a supervised supersession and re-review workflow. No silent overwrite.
6. **Supplier dispatch, VAT/legal accounting, payment matching and tax compliance:** the internal work order approval does not send an external order. Accountant downloads are partial rehearsal packages and do not validate bank receipts or deductibility.
7. **Catherine activation:** an active existing client account was confirmed in Production, but none in Staging. Verify the exact work relationship and physical property assignments, then deliberately grant only those scopes after approved Production release. Do not create a duplicate Production account or alter her role to admin.
8. **PR size and release train:** over 100 touched files; split or stage review into schema/RLS, operational UI, accounting/export and release-control boundaries before Production, while preserving dependency order.

### Suggested acceptance order

**A — verify Staging baseline.** Confirm new branch CI, build, security and Vercel readiness; verify index migration and no unexplained Supabase security warnings.

**B — administrator browser.** Validate entity and supplier registers, grant/revoke, visit reviews, ticket transitions, image access, internal budget decisions, cost correction/approval and both ZIP exports.

**C — staff browser.** With a separately designated Staging identity, confirm one assigned property only; submit 45 actual minutes and correction candidate; upload JPG/PNG; view own ticket only; confirm revoked access immediately hides all.

**D — data integrity.** No duplicate invoice, expense or hourly pay; confirmed unit allocations match each property; original costs and proposed recharge documented separately; archived accountant exports contain the correct original hashes and exceptions.

**E — release decision.** Separate explicit owner approval required for Production, with rehearsed migration/rollback and a post-deploy permissions review. **Do not merge PR #143 by default.**

### Phase one completion definition

The technical foundation and isolated database security are mature enough for **manual Staging acceptance**, not for an unattended Production switch. Production-readiness remains **NO-GO** until the blockers above have owner acceptance and supporting evidence. Preserve the strong distinction between technical CI, unauthenticated route probes, rolled-back PostgreSQL acceptance, and a real signed-in end-to-end browser test.
