# Mase mailbox intake — staging pilot (disabled)

Mailbox: mase@mzsgroup.eu; IMAP mailspace.org:993, verified TLS.
The read-only connection diagnostic succeeded from a Vercel build on 12 November 2026: login plus INBOX and Verwerkt STATUS passed. This is not evidence of completed invoice ingestion.

## Implementation
The staging admin page /admin/workspaces/accountancy/purchases/mailbox contains the connection test and a gated batch import form.
The import endpoint checks active admin, preview/staging environment, same-origin request, configured Mase issuer, selected financial year, scanner readiness and the explicit import switch before connecting.

Pinned ImapFlow 2.11.0 and MailParser 3.14.3 retrieve at most five messages per batch using a read-only INBOX lock and UID-based download. Whole messages are capped at 16 MiB; at most five PDF attachments of 4 MiB per message. Unsupported attachments require attention; CID inline images are ignored. Mail HTML is not rendered and body text is not logged. The UI offers retry and next-batch controls.

PDF persistence is shared with website uploads through retainPurchasePdf. It retains the original privately, scans before PDF extraction, stores proposals and reuses issuer/SHA matches only after verifying the retained bytes. Another financial year is a conflict. Expense concepts still require the existing explicit review/confirmation; supplier and invoice-number uniqueness remains enforced there. No payments, tax claims or automatic entity/year inference are added.

Partial failures leave stored PDFs retryable. There are intentionally NO MOVE, STORE or EXPUNGE commands, no scheduler and no production activation in this pilot. All messages remain in INBOX, even after successful staging review. The real Fenie expense in production remains unchanged.

## Activation prerequisites
Preview branch feature/mase-mailbox-import must use Supabase senonkpxdtlhyhrubicg:
- MZS_MASE_IMAP_PASSWORD: branch-scoped sensitive secret (already provisioned).
- MZS_MASE_ISSUER_ID: verified Mase issuer ID from staging, never a production ID guessed from memory.
- MZS_MASE_IMPORT_ENABLED=true: only after the remaining prerequisites are met.
- Existing scanner configuration described in purchase-pdf-intake.md: owner approval of provider/region/privacy terms, private scanner API key, staging scanner service-role credential, enable/approval switches.

The Cloudmersive adapter transfers PDF bytes to that third party. No real invoice has been sent by this pilot. Scanner and import switches remain disabled pending approval and configuration.

## Verification
Ten targeted mailbox tests pass: real MIME decoding, attachment/message limits, partial failures/retry, read-only enforcement, cursor handling, authorization, scanner/import gates, origin and issuer checks. Three existing upload tests and a new corrupted-duplicate source test pass. Dependency installation/audit reported zero known vulnerabilities. Full CI/build checks are required on the latest commit.

## Remaining before production
Run a synthetic authenticated upload/scan/review/confirmation/retry test on the deployed preview and verify the original PDF checksum and one resulting concept. Verify UI on desktop/mobile. Test real invoices only after processor approval.
Add durable mailbox source/attachment receipts keyed by mailbox/folder/UIDVALIDITY/UID before automatic processing and moving messages. Implement a separate move step only after every eligible attachment has a verified final result, with UIDVALIDITY checks and safe interrupted-move recovery. Do not move the original production-source mail during a staging trial.
