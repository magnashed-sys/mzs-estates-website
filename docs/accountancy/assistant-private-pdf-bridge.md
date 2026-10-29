# MZS Group — authenticated assistant PDF receiver (Staging candidate)

Related issue: #187. This implements the RECEIVING endpoint only. It does not fetch ChatGPT file/Library URLs or mean that a ChatGPT conversation can now directly send its attachments.

## Security and transfer flow

1. An explicitly authorized client/agent obtains a short-lived, user-scoped Supabase Auth JWT through a supported authorization flow. A password, secret service-role token or access token must never be pasted into chat, printed to logs, committed to GitHub or included in a URL.
2. The client sends the exact original PDF bytes to the HTTPS route /api/admin/assistant-originals as an application/pdf POST, together with the Authorization: Bearer [user JWT], x-mzs-cost-draft-id [existing UUID], x-mzs-file-name [URL-encoded basename] and x-mzs-file-sha256 [lowercase SHA256].
3. The endpoint is DISABLED BY DEFAULT and available only on Vercel Preview with Supabase STAGING (senonkpxdtlhyhrubicg). It rejects production, wrong project, browser cross-origin submissions, invalid/missing JWTs, inactive or non-admin users, unknown invoice drafts and malformed file names. The cost's entity and fiscal year come from the authenticated database read, not the request.
4. Files are limited to 4 MiB and require PDF signature and a matching real SHA256. The existing explicitly approved Cloudmersive Advanced Virus Scan integration must be configured and return a clean, validated verdict. Disabled/unknown/malicious scans never enter the archive.
5. The handler deduplicates retained originals by entity/year/hash. New clean PDFs are stored in the already-private MZS accountancy bucket with random IDs and no overwrite. The handler downloads the stored original and checks the size/hash before inserting the immutable PDF index with Pending review, then links it to its existing expense concept under RLS. On retries, it re-verifies and reuses existing originals.
6. Replies report a verified archive and active link, an archived original with an unconfirmed link, or a specific failure. No invoices are issued or marked paid. No VAT claims, tax filings, bank details or supplier/customer access are changed.

## Required activation and acceptance

- Obtain privacy, processing-region, scanner-provider, DPA and retention approvals before enabling external scanning. No real file is sent to a scanner without them.
- On a designated Staging Preview branch only, configure MZS_ASSISTANT_PDF_BRIDGE_ENABLED=true and existing MZS_OPS_AV_SCAN_ENABLED=true, MZS_OPS_AV_PROCESSOR_APPROVED=true, and the private MZS_OPS_CLOUDMERSIVE_API_KEY. Absent approval, this endpoint returns 404 or 503, never accepting a PDF.
- Connect a separate *authorized sender* that actually has the original ChatGPT attachment bytes. The current Supabase tool offers no Storage byte upload. A ChatGPT Library link is not a public download URL. Review current ChatGPT custom MCP connector availability and WRITE entitlements before claiming a full direct integration. ChatGPT Work's user-approved browser upload is a separate possible path, not implemented by this PR.
- Run signed-in synthetic Staging E2E (admin, client and anonymous denial; exact original upload/download; scanner response and privacy, RLS, SHA, matching cost, retry/duplicate, ambiguous archive, and link failure). Keep service-role credentials and real invoice originals out of tests and GitHub.
- The staged code requires no DB migration and cannot run in Production. Production activation requires separately reviewed auth/AV controls, owner authorization and verification.

## Scope limitations

This first stage accepts only evidence for an *existing supplier expense concept*. A buyer, entity/year, or property association cannot be invented by the caller. Unmatched supplier registration, proformas, property-only purchase deeds, OCR, batch ingestion and automatic payments remain outside this version. Never turn a proforma into a definitive expense.

The three M.R. Real Estate invoice concepts currently in Production still await their own original PDF attachments. This Staging PR does NOT transfer, replace, link or certify them. SQL inserts into storage.objects do not store PDF bytes in Supabase Storage.

No secrets, real invoices, URLs with credentials, or customers' financial data are committed as part of this receiving bridge.
