# Mase mailbox intake — preparation, not an active importer

Mailbox: mase@mzsgroup.eu. IMAP: mailspace.org:993 with certificate validation.
Destination folder requested by the owner: Verwerkt.

## Evidence on 12 November 2026
A credential-free connection from the development runtime resolved mailspace.org and received a Stalwart IMAP OK greeting over validated TLS 1.3. This proves transport reachability only, not login, folder access, Vercel connectivity or successful invoice ingestion.

## Read-only diagnostic
Run `node scripts/check-mase-mailbox.mjs` with a fresh `MZS_MASE_IMAP_PASSWORD` supplied by a private environment or secret manager, never in an argument, commit, chat or log. It uses the fixed mailbox and host above. It authenticates, runs STATUS for INBOX and Verwerkt and closes the connection. It does not read message content, change seen flags, move mail or send email. Results contain only a stage and stable result code. A missing Verwerkt folder may mean it has a different server-side path; inspect that before changing configuration.

Five simulated test scenarios cover missing secrets, fragmented responses, TLS rejection, login rejection and unavailable folders. Run `node --test tests/mase-mailbox.test.mjs`. The live authenticated check has not been run.

## Remaining integration
The existing purchase PDF intake is staging-only and requires an approved scanner and private scanner credentials; see purchase-pdf-intake.md. Do not enable that provider or transmit real invoices until the owner has selected/approved the processor.

Implementation must:
- Restrict the pilot to preview and Supabase senonkpxdtlhyhrubicg; no production service role.
- Use a maintained IMAP/MIME client for bounded attachment retrieval with BODY.PEEK, without changing seen flags.
- Bind the mailbox to Mase Estates SL explicitly. Resolve the financial year from a reviewed invoice date; do not silently use the current year.
- Record mailbox, folder, UIDVALIDITY and UID as durable source identity. Message-ID alone is insufficient.
- Persist each PDF privately, deduplicate per entity by SHA and supplier/invoice number, scan before extraction, and leave ambiguous proposals for manual review.
- Move the message by UID only after every relevant attachment has a durable, verified result. Unsupported attachments, scan errors, ambiguous scope and partial persistence leave the message in INBOX.
- Make retries safe when the process stops after persistence but before MOVE; do not duplicate concepts.
- Keep the existing real Fenie invoice 2026100716972 / EUR 302.31 in production unchanged. In staging use synthetic data or an explicitly isolated test copy; a staging success must never move the real production-source email.
- Verify a synthetic multi-attachment flow, partial failures, duplicate/retry, missing folder and UIDVALIDITY changes before release.

## Activation prerequisites
A fresh mailbox secret must be supplied securely. Scanner provider approval and credentials are also outstanding. No cron, mailbox ingestion, deployment, production migration or message move is enabled by this diagnostic PR.
