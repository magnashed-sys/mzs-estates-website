# Property Operations — private originals and supplier-cost review (Staging)

**Scope:** Draft PR #143 · 28 October 2026 · Strictly MZS Staging Preview (Supabase `senonkpxdtlhyhrubicg`). **No Production rollout, no automatic messages, payments or outgoing invoices.**

## Implemented functionality

1. The Group Admin registers a *supplier cost draft* on the existing Estates Operations page and verifies the correct paying legal entity and property/unit. The original cost remains separate from any customer recharge.
2. An active Group Admin uploads **one original supplier PDF/JPEG/PNG per draft**, through the authenticated Staging route `POST /admin/workspaces/estates/expenses/documents`. Files are checked by magic bytes (not just filename/MIME), limited to **4 MiB per upload** because Vercel Function request bodies are limited to 4.5 MB. Files are hashed SHA-256 server-side. The Storage bucket is private; paths use anonymous UUIDs under the draft UUID. The Storage policy prohibits overwrite and access by clients, partners and anonymous users.
3. Registration inserts a separate immutable evidence record after the object upload succeeds; if metadata insertion fails, the route attempts to remove the unregistered object. A read-only audit investigation is required if cleanup itself fails. Do not repeatedly retry ambiguous failures without checking the draft/document registers.
4. Authenticated downloads are exposed only via `GET /admin/workspaces/estates/expenses/documents/[id]`, which checks the active administrator role and generates a **60-second download-only signed URL**. Paths and long-lived credentials never appear on public pages.
5. Group Admin explicitly submits a documented draft; then explicitly approves or rejects it (rejection reason required). Database-locked, append-only review events validate each transition and reject stale actions, missing original evidence, unauthorised users and duplicate approvals. Base financial figures are immutable.
6. An **approval is an internal administrative status**, not a tax determination, an issued customer invoice, a payment, a capital movement or an accountant export. No sending or financial movement occurs.

## Explicit limits / further work

- This is the **first acceptance version**, not yet an operational substitute for local bookkeeping. There is still no protected amendment/supersession flow for incorrect approved/rejected documents. Do **not** enter genuine documents that may need corrections until this is added and accepted.
- Rejected expenses remain terminal; create a future audit-preserving replacement/revision workflow rather than silently editing an old draft or deleting the original.
- Not yet connected to the external accountant ZIP export, payment matching, supplier credits, service-period fields, anti-malware scanning, OCR or automated email.
- The first UI is intended for a few reviewable synthetic documents. For uploads above 4 MiB, implement a separate authenticated direct-to-Storage upload handshake so Vercel does not proxy large files.
- The server and RLS checks still require an authenticated browser acceptance pass and native mobile inspection. A Vercel READY state alone does not certify it.

## Acceptance matrix

- [ ] Active Group Admin in exact Staging Preview can upload one synthetic small PDF to an existing synthetic cost draft.
- [ ] Verify it has an immutable metadata record and exact 64-character SHA-256 value; bucket `mzs-ops-expense-evidence` remains nonpublic.
- [ ] Another file upload to the same draft is blocked; a signed download URL expires after one minute.
- [ ] Non-PDF/JPEG/PNG, corrupt signatures, oversize files, missing origin/cross-origin requests, absent/invalid draft ID are blocked without creating approved records.
- [ ] Anonymous, client, partner, inactive admin cannot open, upload or approve documents.
- [ ] Missing source document prevents submission; approval before submission or repeat approval fails.
- [ ] On rejection, reason is mandatory, and history remains intact and immutable.
- [ ] On submission, the source original cannot be replaced; changing totals after approval is impossible.
- [ ] Parallel approvals and stale state reject safely with consistent review sequence.
- [ ] No invoice number is consumed and no customer, supplier or employee email is sent.
- [ ] Staging migrations applied only after exact-commit CI and security review; synthetic test records rolled back.
- [ ] Production unchanged, no real Catherine/Prettig Thuis/Zorgbalans records imported.

## Architecture rationale

Use the existing `mzs_ops_expense_drafts`, verified property payer links and RLS. Add `mzs_ops_expense_documents` as immutable source metadata and `mzs_ops_expense_review_events` as a separate append-only review journal. Do **not** loosen the underlying draft's `status='draft'` check. The current document/review state is derived from the linked evidence row and the most recent review event, which preserves the immutable original.

**Security documentation:** [Supabase Storage access control](https://supabase.com/docs/guides/storage/security/access-control), [Supabase private buckets](https://supabase.com/docs/guides/storage/buckets/fundamentals) and [Vercel Functions request body limit](https://vercel.com/docs/functions/limitations).
