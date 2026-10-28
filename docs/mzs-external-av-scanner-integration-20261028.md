# MZS Group — Supplier Evidence / External AV Scanner Bridge (Staging only)

**Status:** ready for isolated technical review; **NO EXTERNAL SCANNER CONNECTED**. The existing evidence/quarantine modules are on Draft PR #154 and Draft PR #155. This change is stacked on both, is not published in Production, and does not issue invoices or modify monetary data.

## Candidate provider and reviewed interface

An optional adapter for Cloudmersive **Advanced Virus Scan** was prepared against its [API reference](https://api.cloudmersive.com/docs/virus.asp). The authenticated HTTPS endpoint is `POST https://api.cloudmersive.com/virus/scan/file/advanced`, multipart field `inputFile` and `Apikey` header. All documented executable, script, invalid-document, embedded object, encrypted file and unwanted-action controls are set to `false`, with `restrictFileTypes: .pdf`.

We have **not** contracted this vendor, approved data processing, selected an EU/private region, accepted contractual retention provisions, or provisioned an API key. Do not send real customer or supplier data to this provider until legal/DPA, privacy, allowed geography and risk review are complete. Choose a private scanner instead if external document transfer is not acceptable.

## Two independent consent gates, default OFF

The scan adapter makes **no external API call** unless *all* of the following are true:

1. `VERCEL_ENV=preview`, **exact** `NEXT_PUBLIC_SUPABASE_URL=https://senonkpxdtlhyhrubicg.supabase.co`;
2. server-side `MZS_OPS_AV_SCAN_ENABLED=true` (not configured);
3. server-side `MZS_OPS_AV_PROCESSOR_APPROVED=true` (not configured; requires explicit owner/legal consent);
4. server-side `MZS_OPS_CLOUDMERSIVE_API_KEY` is present (not configured);
5. the scan endpoint has a separately provided server-only `MZS_OPS_STAGING_SCANNER_SERVICE_ROLE_KEY` with minimum length checks (not configured).

These must be **branch-scoped Preview variables**, never Production and never prefixed `NEXT_PUBLIC_`. No scanner or Supabase privileged keys were added in this PR. Do not fill them in until the user chooses and approves the vendor. A missing flag, missing key or mismatched environment returns 503 before opening Storage or transmitting bytes.

## Controlled flow after separate approval

1. An active, authenticated Group Admin explicitly initiates an individual scan from the Staging costs UI. The request requires same-origin and a server-validated document UUID, never a client-supplied path, legal entity, key or verdict.
2. A normal user-scoped Supabase client verifies the document's immutable metadata and latest scan state. A clean/malicious decision cannot be overwritten through another scan from this endpoint; only an unscannable result permits deliberate retry.
3. A server-only service client downloads **only that document** from the private quarantined bucket. The backend compares actual bytes, size, PDF header and SHA-256 with the immutable document record. Mismatch = 409 and **no external call**.
4. Only then does the provider adapter transmit those exact PDF bytes over a fixed HTTPS endpoint with redirects disabled, no URL construction or supplier names in filenames. Network errors, timeout, rate limits, invalid JSON, unknown protection flags and unsupported formats become `unscannable` (quarantine remains).
5. Only an explicit, verified `CleanResult=true`, zero detected viruses, supported PDF type and *all* listed hazard flags explicitly `false` produces an internal `clean` verdict. A threat produces `malicious`; ambiguous provider replies stay `unscannable`.
6. The service client inserts a SHA-bound `mzs_ops_expense_document_scan_events` record. The existing Staging database trigger compares it against the immutable source hash. The read and review RLS policies remain separately fail-closed.
7. The API returns only verdict/short status, never original file bytes, Storage paths, API key or scanner's untrusted raw JSON.

## Threat model and open issues

- **No provider key or scanner is connected in this release.** All successful response tests are simulated with injected fake HTTP responses, *not an actual certified malware scan*. Do not fabricate `clean` events in Supabase.
- The adapter's strict completeness rules may reject genuine provider responses that omit an optional flag. That must be resolved with documented, authenticated provider acceptance tests before enabling it; the safe default is deny.
- The next authenticated acceptance must prove legitimate synthetic PDF is scanned with a paid/approved account, an EICAR-style test is rejected in an isolated non-Production environment (only if the provider explicitly permits it), 429/timeout is quarantined, signed download expiry, admin/user isolation, malformed PDF rejection, concurrent scans, and idempotent auditable retries.
- A provider's claimed "clean" status alone is not a proof of total safety or absence of every active PDF exploit. Maintain restrictive PDF admission and external DPA, plus content disarm or on-premise scanning if required.
- A per-provider regional residency/DPA and data lifecycle review is required. Do not select a data processor or send real documents without explicit approval.
- Stored-document retention and legal holds are still to be implemented per legal entity and jurisdiction; correction/replacement must preserve immutable originals and linked audit trail.
- Later automate scanning from a durable bounded queue with retries, outbox and privileged orphan cleanup. **No background job, email, accounting export or payment action is created here.**
- Production remains at its existing reviewed commit and has no evidence Storage bucket or scan journal.
