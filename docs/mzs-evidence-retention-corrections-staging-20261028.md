# MZS Group — Evidence retention and supplier correction acceptance (Staging only)

**Scope:** isolated Accountancy supplier evidence. **No Production release.** No finance postings, issued invoices, bank payments, email, exported accountant packages or document deletion.

## Retention design
- Append-only `mzs_ops_expense_retention_proposals`: one pending proposal per legal entity, jurisdiction (ISO 2-letter), supplier-document category, proposed duration 1–30 years and a specific legal/source reference. **The proposal is not approved policy**: local accountant/legal verification is required before implementing a binding schedule.
- Append-only `mzs_ops_expense_document_holds`: an administrator can place an explicit legal hold on one existing immutable evidence document. The hold cannot be released or deleted in this phase. Every original remains private and protected, whether or not a hold exists. No automatic cleanup is implemented.
- Both tables have RLS, INSERT only for active Group Admin, no direct UPDATE or DELETE, and trusted actor defaults. Empty tables by default. All operations are gated to exact Staging Preview.
- Do not guess a universal NL/ES/UAE tax retention period. Local advisors determine applicable tax, contractual, privacy and litigation rules per legal entity/country. A later reviewed workflow must implement release, verified retention and deletion with independently audited approval and legal-hold precedence.

## Correction / supersession
The three pre-existing Staging-only correction migrations (already installed on MZS Staging) are reused; this PR does NOT reapply them. The three-part admin workflow is now exposed *on Staging only*:

1. Propose a corrected description, net/VAT amounts and validated unit allocation **after** a completed review. Original source and amounts stay immutable; the proposal is a separate row. Multi-unit corrections remain blocked from the simple UI until a dedicated editor is reviewed.
2. Decide explicitly `declined` or `replacement_required`, with reason and audit history; do not directly edit an approved cost.
3. Link a separately created and approved replacement supplier expense **with its own scanned source**, same legal entity/property/supplier, distinct supplier reference, and a verified correction decision. Original remains unchanged; the future accountant export must avoid counting the superseded item twice.

All correction forms require an additional explicit confirmation that this is fictional Staging data. The database independently enforces role and parent/property relations.

## Current release blockers
- The external Cloudmersive scanner adapter is not configured or approved; no real scanner event exists. Therefore evidence remains in quarantine and real approval/correction scenarios cannot yet be accepted end to end.
- No genuine supplier documents may be uploaded to Staging; use marked synthetic test PDFs only.
- No authorised legal retention period has been established; no automatic disposition, legal hold release or deletion is allowed.
- No authenticated user acceptance on the combined edit+review+replacement scenario is complete.
- Supplier invoices and local accountant exports may only move to Production after independent consent, malware scanner validation, retention/privacy review, independent full flow tests, and explicit owner go-ahead.

## Test and deployment plan
1. Exact-head CI build, typecheck, tests and security checks; Preview connected to MZS Staging only.
2. SQL rollback-only test on Staging, followed by separately logged additive Staging migration for the two append-only retention tables.
3. Verify RLS, zero rows, no anon access, no authenticated UPDATE/DELETE, old correction rows and private file counts unchanged; check Supabase advisors.
4. Keep Draft PR stacked on the Staging AV adapter PR, and never merge into `main` or set Production environment variables.

## Release guard

This PR must remain Draft and unmerged even after Staging acceptance. Any staging write requires a real authenticated Group Admin account; synthetic SQL transaction tests are rolled back. The Production expense route does not query these new tables or render correction/retention controls. No retention proposal is legally binding until the relevant local accountant verifies it.
