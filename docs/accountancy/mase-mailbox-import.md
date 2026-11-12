# Mase mailbox intake — release preparation, disabled

Mailbox: mase@mzsgroup.eu. IMAP: mailspace.org:993 with verified TLS.
Source: INBOX. Destination: Verwerkt.

## Delivery scope
An active Group Admin starts bounded batches (five messages, five PDF attachments per message, 16 MiB message / 4 MiB PDF limits), chooses the financial year and reviews the proposed invoice fields.
The importer uses EXAMINE and does not mark mail seen. It retains the original PDF privately and requires a clean scanner result before extraction. SHA/issuer deduplication verifies stored bytes; another year is a conflict. Confirmation remains manual; no payment or tax claim is generated.

Durable receipts are created only after every eligible PDF is clean and retained. Identity is mailbox/folder/UIDVALIDITY/UID, with a full-message SHA and ordered PDF SHA/intake references. Database errors and partial imports never produce a complete receipt. Repeating intake uses existing PDFs. Receipt identity and scope are immutable.

The admin separately requests movement after all attachments have accepted decisions. Database and application both enforce this. Before moving, stored originals, clean results, decisions, source UIDVALIDITY and full-message hash are reverified. Only native IMAP MOVE plus UIDPLUS are allowed; COPY/DELETE fallback is prohibited. The destination UIDVALIDITY, UID and downloaded message checksum must match before marking moved.

A conditional review -> moving update prevents simultaneous moves. Known pre-MOVE failures return to review. A missing acknowledgement or failed destination verification becomes uncertain. A process crash may leave moving. Neither moving nor uncertain is automatically retried; an operator must reconcile both folders and the recorded source checksum. No success is inferred from the source disappearing. Receipt data is visible only to active admins, writable only by the backend.

## Isolation and release switches
Preview must use senonkpxdtlhyhrubicg. Production must use ptrnjzmcehrhbsfxntgw and MZS_PURCHASE_PDF_PRODUCTION_READY=true. No preview can move the real source mailbox. The module has no cron: the first release is explicitly admin-operated.

All switches remain disabled until the acceptance steps below:
- MZS_MASE_IMPORT_ENABLED=false
- MZS_MASE_MOVE_ENABLED=false
- MZS_PURCHASE_PDF_PRODUCTION_READY=false
- MZS_OPS_AV_SCAN_ENABLED=false
- MZS_OPS_AV_PROCESSOR_APPROVED=false

## Subscription/configuration handoff
Do not buy a plan or transmit real invoices as part of offline readiness work.
After the owner arranges the EU-capable Cloudmersive subscription:
1. Obtain the EU Germany endpoint from the subscribed portal API Endpoints page. Do not invent a hostname. Set MZS_OPS_CLOUDMERSIVE_BASE_URL to that HTTPS origin and MZS_OPS_AV_REGION=eu-de only after verifying its assigned region and privacy agreement. There is no global-endpoint fallback.
2. Store MZS_OPS_CLOUDMERSIVE_API_KEY as a server-only sensitive secret.
3. Preview uses MZS_OPS_STAGING_SCANNER_SERVICE_ROLE_KEY; production uses a separately provisioned MZS_PURCHASE_SCANNER_SERVICE_ROLE_KEY. Never reuse a production key in preview.
4. Set MZS_MASE_ISSUER_ID from the actual target database and confirm the year belongs to that issuer. Production IDs must never be copied into staging.
5. Provision the IMAP password server-side. Never place it in source, tests, logs or browser configuration.

## Database rollout
The existing 20261029155105_purchase_pdf_intake_staging.sql establishes intake/results/decisions and the private quarantine bucket. It exists on staging, not production as checked 12 November 2026.
The new 20261112200134_mase_mailbox_receipts.sql adds the receipt register and transition checks; applied to staging only.
Before release, inspect production prerequisites and deploy both intake and receipt schemas in dependency order through the controlled migration process. Do not rerun all historical staging migrations or seed demo data into production. Confirm RLS, privileges, bucket privacy and confirmation function permissions after rollout.

## Validation
Offline tests cover MIME parsing, partial/repeated imports, receipt failure, clean-source checks, corrupted-original rejection, permission/origin/environment gates, native-MOVE and UIDVALIDITY requirements, concurrent move claims, lost acknowledgements, bad destination checksums, and database permissions/transitions.
The existing PDF intake tests cover extraction, quarantine, confirmation and duplicate originals. Fake scanner responses exist in tests only; no production bypass exists.

Before activation, still required:
- Full CI/typecheck/build on the final commit and authenticated preview UI inspection.
- Live synthetic PDF scan through the subscribed EU endpoint (including unsafe/unknown result and timeout handling).
- Authenticated deployed upload/import -> original checksum -> review/confirmation -> repeat, proving one expense concept.
- A controlled production mailbox move after confirmation, proving destination content and receipt state. Staging must never move the real invoice mail.
- Verify the existing Fenie concept is not duplicated: an earlier manually booked invoice requires explicit reconciliation, not a second confirmation.

## Rollback
Disable import and move first, then scanning; preserve receipts, PDFs and decisions. Do not delete ledger evidence. In-flight or uncertain moves require reconciliation before re-enabling. No real mail was moved and no invoice was sent to Cloudmersive during preparation.
