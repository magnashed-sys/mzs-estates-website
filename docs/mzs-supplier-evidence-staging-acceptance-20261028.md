# MZS Group — Supplier invoice evidence and review: isolated Staging acceptance

**Date:** 28 October 2026. **Environment:** MZS Staging only. **Production remains unchanged.**

## Scope
This Draft branch adds the previously developed evidence/review UI and authenticated routes to the current Production code **but allows the upload and review functions ONLY on the isolated Staging Preview** (Staging Supabase project `senonkpxdtlhyhrubicg`). Production routes respond 404 or remain hidden.

- One private, nonpublic Storage bucket `mzs-ops-expense-evidence` is already present on Staging, with RLS for active Group Admin only.
- Each fictional cost draft can carry at most one original evidence record, with anonymous UUID Storage name under the draft ID and SHA-256 digest. The original is immutable after review.
- To reduce risk from image metadata, the first acceptance version allows only **fictitious PDF test files** up to 4 MiB, checked by file signature server-side; JPG/PNG are not accepted by the route even though the pre-existing Staging bucket permits them.
- Admin must attest that the file contains no real personal details or supplier data. This is a workflow safeguard, not an independent content scan.
- Internal review transitions: draft → submitted → approved/rejected, with explicit fictional review confirmation and stale-state database safeguards.
- Reviewed status is not a payment, outgoing invoice, tax filing, legal conclusion or accountant export. No bulk imports or emails.
- The download handler requires an authenticated active admin and creates a private, 60-second, download-only signed URL with no-store response headers.
- Never upload actual Catherine, Zorgbalans, Prettig Thuis, supplier, bank or other personally sensitive files into Staging.

## Verified initial conditions
- Staging has **0** expense drafts, **0** documents, **0** review events, **0** uploaded objects.
- Production has the expense-draft module but **0** drafts; **no** evidence tables or evidence Storage bucket.
- Full Staging feature migration and roles were previously applied on Staging; this PR adds no new migration and does not run SQL on Production.
- Release only after green CI/security and a Preview build on Staging. An authenticated browser test and a controlled synthetic PDF upload will remain separate acceptance steps.

## Production acceptance blockers
Do NOT enable real supplier-document uploads in Production until:
1. Malware/content scanning and quarantine / storage release decision for untrusted PDFs, with testing for script-bearing and malformed content.
2. Original retention and deletion/legal hold policy, including audit of failed/unregistered object cleanup.
3. Role and entity scope; privacy review; signed URL expiry and session validation.
4. Approved/rejected evidence correction/supersession process; eventual accountant export must preserve source hashes and exception tracking.
5. Authenticated end-to-end desktop/mobile acceptance, anonymous/client/partner denied test, link expiration, duplicate upload and upload-failure cleanup.
6. Independent Production backup restoration evidence for rollout risk, and separate owner acceptance of file upload functionality.

**This branch is not approval to promote the whole earlier Draft PR #143 or the Staging-only Storage SQL.**


## Synthetic PDF admission and reusable sample

- All Staging document uploads must pass the original PDF MIME, size, actual magic bytes, private login and same-origin checks. In addition, the untrusted byte sequence must start with a supported `%PDF-` version, contain a valid end marker and basic structure, and carry a **special exact MZS synthetic-test marker in its initial bytes**.
- Obvious active instructions (JavaScript, OpenAction, Launch, embedded files, XFA, encrypted documents, etc.) are rejected. These are cheap **heuristics only**; they do not unpack compressed or obfuscated malicious content and are **NOT antivirus, content-disarm, or a malware-safety certification**.
- Reproducible *fictional* one-page source: `scripts/generate-mzs-synthetic-expense-pdf.mjs`. Generate a local fixture using `node scripts/generate-mzs-synthetic-expense-pdf.mjs /tmp/mzs-synthetic-expense-test.pdf`; no customer/supplier data is used.
- The matching client-side file input accepts PDFs only, and the active Group Administrator must confirm it is fictitious before submitting. The server makes the marker/magic check **before the private Storage mutation**.
- Invalid, unmarked, too-large, truncated or obvious active-content documents never reach the upload call. Tests also check that the fixture can be parsed by `pdf-lib`.
- The project has **no connected, authenticated malware scanning service**. Production real-document upload remains blocked regardless of this improvement; do not change the Production URL guard or import the evidence Storage migration until the scanner and quarantine lifecycle are implemented and tested.

## Acceptance still outstanding

- A real authenticated Staging browser upload and review with the generated sample fixture.
- Malware scanning integration (fail closed on unknown/error/timeout), quarantine and controlled release, evidence-retention/deletion policy and correction/supersession after a reviewed original.
- A verified isolated recovery rehearsal of the Production backup before Production private-file enablement.
