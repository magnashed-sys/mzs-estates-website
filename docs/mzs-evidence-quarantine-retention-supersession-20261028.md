# MZS Group — Document Security Gate / Staging 3C

**Stage:** STRICT FAIL-CLOSED QUARANTINE. **Production: NO CHANGE.** Scope: supplier-cost evidence only; not customer statements, issued invoices or Capital documents.

## Newly implemented in this Staging branch

1. **Private evidence stays locked.** The existing `mzs-ops-expense-evidence` Storage SELECT policy is replaced on Staging: even a Group Admin cannot read an unscanned PDF. Read access requires an immutable document record whose SHA-256 matches the **latest trusted scanner event** with verdict `clean`. No event, `malicious`, `unscannable`, a mismatched hash, or an unavailable scan register means **deny**.
2. **Scanner journal.** New append-only `mzs_ops_expense_document_scan_events` table stores document ID, observed immutable SHA-256, verdict, engine/version, external scan reference, scan time. RLS: clients/anonymous users cannot read/write; administrators may only read; **only a service-role backend** can insert an actual scanner verdict. The DB checks the SHA before insert. No other application or API in this branch emits verdicts. Scanner engine/version/reference are provenance fields **not a cryptographic attestation** on their own.
3. **Review is independently gated at the database layer.** A new trigger blocks `submitted` and `approved` events unless the latest scanner event says `clean` with matching original SHA. The existing review transition constraints and audit remain in force.
4. **Short-lived signed URL creation also checks quarantine.** The download handler refuses with HTTP 423, before signing, when no matching `clean` verdict is found. Any signed URL generated *before* a subsequent malicious finding can remain usable for up to its original 60-second expiry; the Storage SELECT RLS will reject newly issued URLs.
5. **Admin UI makes quarantine explicit.** No download action or review form for pending evidence. The upload route returns `202 Accepted` with `quarantined:true`; this means *stored but **not** security-approved*. The route reports Storage cleanup failures rather than falsely claiming an orphan was removed.
6. The old Production financial/booking tables and the existing isolated pilot are never queried or written by this migration.

## Missing external scanner — intentional hard stop

**No actual malware-scanning provider, scanner webhook or secret was connected.** Therefore no trustworthy `clean` events are generated, and no document can be viewed, submitted or approved. The synthetic marker and basic PDF structure checks from PR #154 remain useful as intake safeguards, but are not antivirus. NEVER create a synthetic `clean` verdict in the actual Staging or Production database to circumvent the gate.

When selecting a scanner: use a separate server-side service identity, verify provider-origin authentication, hash the exact original bytes, store engine/version/receipt, make failure/timeout/error `unscannable`, retry via bounded queue, and test clean/malicious cases in an isolated disposable environment. The scanner must not receive unrestricted Storage credentials or gain financial-record mutation rights. A privileged service role in the wrong function is a security risk.

## Storage orphan and recovery handling

The strict SELECT policy means an unregistered quarantined object is also unreadable to an ordinary admin, and the Storage remove call may fail; the route reports that explicitly and asks an administrator to reconcile safely. A future privileged cleanup worker should list orphan paths without allowing public disclosure, confirm no immutable document metadata references the object, and remove only after logging a decision. Do not broaden SELECT just to make cleanup easy.

## Retention and document corrections — decision architecture, NOT yet live

- Preserve immutable originals and SHA-256, and append scan/review events. A later correction should create a **new cost draft** with a new source document, linked to the superseded one with an explicit correction reason, effective date and second-person approval where appropriate; never overwrite a reviewed original or delete a review/scan event.
- Introduce per-entity/per-country retention schedules only after accountants and legal counsel verify applicable tax, contractual, privacy and litigation-preservation obligations. Do not assume a universal number of years. Add `retention_policy_id`, `retain_until`, `legal_hold`, `disposition_state` and auditable deletion only after scope-approved policy.
- A legal hold must override routine deletion. Redact or purge personal data where legally appropriate without removing the minimally required audit evidence; policies need an explicit owner.
- No background deletion, scanner service, external accountant export or customer email is implemented here.

## Acceptance / release gates

- Full GitHub tests, Next.js build, TypeScript and security checks on the exact commit.
- Staging SQL **BEGIN … ROLLBACK** rehearsal; verify no pre-existing evidence is changed. Apply the Staging migration **only after** security and release checks.
- Offline PGlite fixture tests pending -> no read/no submit, no client scan insert, wrong SHA denial, a *simulated local-only service-role clean* permitting review, and a subsequent local-only malicious verdict immediately re-blocking storage.
- Post-migration Staging: new table RLS, 0 scan events, no anon read, no authenticated INSERT/UPDATE/DELETE, and restricted `storage.objects` SELECT. No files or live accounting data.
- Preview on Staging only, signed-in browser workflow still pending. A READY Preview alone is not acceptance for real supplier documents.
- **Production remains blocked** until provider scanner integration, quarantine worker, retention/correction procedure, authenticated upload/download E2E test, privacy/security review and separately approved Production release.
