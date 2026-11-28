# MZS Group — authenticated assistant PDF receiver (Staging candidate)

Related issue: #187. Includes a receiving endpoint and a same-origin browser sender, both restricted to Staging. It does not register a native ChatGPT plugin or fetch arbitrary ChatGPT file/Library URLs.

## Security and transfer flow

1. An authorized operator signs into the Staging admin site and opens `/admin/workspaces/accountancy/documents/assistant`. The browser sender uses that existing session without reading or exporting tokens. Alternatively a separately authorized client obtains a short-lived, user-scoped Supabase Auth JWT through a supported authorization flow. A password, secret service-role token or access token must never be pasted into chat, printed to logs, committed to GitHub or included in a URL.
2. The client sends the exact original PDF bytes to the HTTPS route /api/admin/assistant-originals as an application/pdf POST, together with the Authorization: Bearer [user JWT], x-mzs-cost-draft-id [existing UUID], x-mzs-file-name [URL-encoded basename] and x-mzs-file-sha256 [lowercase SHA256].
3. The browser sender selects at most 25 originals and an existing draft for each, hashes the exact bytes and sends sequential requests without an Authorization header. Cookie authorization requires a matching Origin and `Sec-Fetch-Site: same-origin`; mixed cookie/bearer submissions and cross-origin requests are rejected. Both authorization paths verify the user through Supabase Auth and enforce active admin status. The endpoint is DISABLED BY DEFAULT and available only on Vercel Preview with Supabase STAGING (senonkpxdtlhyhrubicg). It rejects production, wrong project, unknown/non-draft invoices and malformed file names. The cost's entity and fiscal year come from the authenticated database read, not the request.
4. Files are limited to 4 MiB and require PDF signature and a matching real SHA256. The existing explicitly approved Cloudmersive Advanced Virus Scan integration must be configured and return a clean, validated verdict. Disabled/unknown/malicious scans never enter the archive.
5. The handler deduplicates retained originals by entity/year/hash. New clean PDFs are stored in the already-private MZS accountancy bucket with random IDs and no overwrite. The handler downloads the stored original and checks the size/hash before inserting the immutable PDF index with Pending review, then links it to its existing expense concept under RLS. On retries, it re-verifies and reuses existing originals.
6. Replies report a verified archive and active link, an archived original with an unconfirmed link, or a specific failure. No invoices are issued or marked paid. No VAT claims, tax filings, bank details or supplier/customer access are changed.

## Required activation and acceptance

- Obtain privacy, processing-region, scanner-provider, DPA and retention approvals before enabling external scanning. No real file is sent to a scanner without them.
- On a designated Staging Preview branch only, configure MZS_ASSISTANT_PDF_BRIDGE_ENABLED=true and existing MZS_OPS_AV_SCAN_ENABLED=true, MZS_OPS_AV_PROCESSOR_APPROVED=true, and the private MZS_OPS_CLOUDMERSIVE_API_KEY. Absent approval, this endpoint returns 404 or 503, never accepting a PDF.
- The browser sender can receive original files through ChatGPT Work's authorized file chooser after Work has materialized the user-provided original. This avoids a second manual upload by the user where the browser and file capabilities are available. It is a separate route from a native plugin and still requires a signed-in Staging admin and the approved scanner. The current Supabase tool has no Storage byte upload. A Library file ID or Library page URL is not a public download URL.
- Run signed-in synthetic Staging E2E (admin, client and anonymous denial; exact original upload/download; scanner response and privacy, RLS, SHA, matching cost, retry/duplicate, ambiguous archive, and link failure). Keep service-role credentials and real invoice originals out of tests and GitHub.
- The staged code requires no DB migration and cannot run in Production. Production activation requires separately reviewed auth/AV controls, owner authorization and verification.

## Scope limitations

This version accepts only evidence for an *existing supplier expense concept*, with batches of at most 25 sequential requests. A buyer, entity/year, or property association cannot be invented by the caller. Unmatched supplier registration, proformas, property-only purchase deeds, OCR and automatic payments remain outside this version. Never turn a proforma into a definitive expense. The ordinary archive bulk form remains separate; its PDF/hash validation is not an antivirus verdict and must not be used to bypass the assistant transfer's required AV approval.

The three M.R. Real Estate invoice concepts currently in Production still await their own original PDF attachments. This Staging PR does NOT transfer, replace, link or certify them. SQL inserts into storage.objects do not store PDF bytes in Supabase Storage.

No secrets, real invoices, URLs with credentials, or customers' financial data are committed as part of this receiving bridge.

## Native ChatGPT integration still required

As checked on 2026-11-01, the [OpenAI Plugins reference](https://developers.openai.com/plugins/reference) supports original input files through `_meta["openai/fileParams"]`. The declared top-level object/array file parameter includes `download_url` and `file_id`; optional `file_name` and `mime_type` must also be declared if used. An installed MZS tool could therefore receive a user-selected original without asking the user to upload it again. File access alone does not authorize writing to MZS.

Before activating that route:

- Register a customer-controlled MZS MCP/plugin with a narrowly defined archive-original tool and the supported file parameter contract. Do not add a general URL-fetch endpoint. Validate trusted file-download origin, redirects, streaming size and expiry; prevent SSRF, redact file URLs and discard temporary bytes after processing.
- Implement the [OpenAI OAuth authorization contract](https://developers.openai.com/plugins/build/auth) with authorization-code + PKCE, resource/audience, issuer, expiry and scope verification. Bind the authorization to the MZS user and active admin permission. Do not reuse the broad connected Supabase management tool or an API/service-role key as user authorization. Supabase OAuth additionally requires client-specific RLS so the grant cannot expose unrelated direct database/Storage APIs.
- Complete processor, region, DPA, retention and malware-handling approval for the actual scanner. Then run signed-in synthetic Staging acceptance before any real originals or production activation.
- Return a receipt containing the archive ID, existing draft ID, retained-byte SHA-256 and verified-link status. No receipt may imply accounting approval or payment.

## Validation evidence and remaining gate (2026-11-01)

The local route integration suite exercises synthetic byte transfer through both authorization paths, inactive/client/anonymous denial, CSRF, mismatched SHA, malicious/unknown scans, stored-byte corruption, duplicate reuse and unconfirmed links. Auth, scanner and Storage in these route tests are doubles; these results are **not live Staging E2E evidence**. The production-build and repository test suite pass. The accompanying branch is configured with bridge and scanner flags explicitly false, and no processor approval is granted by this change. Live authenticated upload/scan/Storage/draft acceptance remains blocked until approved scanner configuration is supplied.

The bulk classifier now recognizes years delimited by underscores (for example `INV_2024_00003.pdf`) so an original is not silently assigned the current default year. Classification remains a proposal requiring review.
