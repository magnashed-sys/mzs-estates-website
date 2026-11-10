# Upcoming interest reminders

The feature defaults off and no recipient is seeded. The owner reviewed the first message and authorized activation on 10 November 2026, including a branded sender and BCC copy for each reminder. Addresses are deployment configuration, not source data. Do not publish customer identities, email addresses or payment figures in this public repository or PR.

The daily 08:00 UTC job considers explicitly opted-in, agreed/active loans provided, with an interest payment due in five calendar days (Europe/Madrid). It catches a missed run within the remaining one-to-five-day window; never sends this advance reminder on or after the due date. No principal or fee reminders and no reminders on loans received. Only scheduled terms are considered; the feature does not create future terms or infer interest.

The database calculates the current remaining amount from all non-void receipts, applying interest surpluses to oldest interest deficits first. Recipient must remain the selected active borrower with an active deal grant, matching confirmed Auth and profile email, and the authorizing administrator must remain active. Changing the recipient's email requires a reviewed settings change. Fully settled terms are skipped. A transactional per-instalment claim, stable Message-ID and durable outcome prevent duplicate sends. Pending, failed and uncertain claims require investigation, never automatic retries. Snapshots are revalidated just before SMTP; payment or recipient changes cancel dispatch. As with other SMTP flows, a payment registered after the last check can cross with an email already in transport. Copy explicitly handles that case.

Settings and immutable dispatch snapshots are admin-readable only. Delivery RPCs are service-role-only. No browser receives service credentials. Preview and local deployments cannot send, even with production data/config accidentally present. SMTP uses the existing MZS configuration; `accepted` means accepted by SMTP, not confirmed inbox delivery. No Gmail automation is introduced.

Set `MZS_CAPITAL_REMINDER_FROM` and `MZS_CAPITAL_REMINDER_COPY` to the separately reviewed addresses. The sender name and signature are MZS Group. Every email includes the copy as BCC. Both recipients must be accepted before a delivery is recorded as accepted; partial acceptance remains uncertain and is not automatically retried. Envelope metadata and individual acceptance are retained in the private ledger. The active-admin dossier panel can send a selected due reminder, using the same worker, opt-in checks and durable claim as cron.

## Release and activation

1. Review the prepared email and recipient privately with the owner; obtain activation authorization. Test the additive migration in staging using synthetic recipients only.
2. Apply the additive migration in production, provision the reviewed deal's settings with `enabled=false`, the exact active borrower user/email, language (`en` or `nl`), first due date and active authorizing admin. Settings are managed by the trusted operator, not exposed as an unreviewed general mailing feature.
3. Deploy the reviewed code and check the cron endpoint with its existing secret. Set `MZS_CAPITAL_REMINDERS_ENABLED=true` only when ready; require existing `MZS_CAPITAL_DEALS_ENABLED=true`. Enable just the reviewed dossier. An authenticated cron invocation may dispatch the first reminder if activation is after the daily run, still before its due date.
4. Inspect `mzs_capital_reminder_deliveries` for that instalment and verify mailbox receipt separately. Do not resend on ambiguous SMTP/DB acknowledgement. Review `sending`/`uncertain` records operationally.

Pause using the environment flag or the individual settings `enabled=false`; retain the ledger. The settings table is intentionally empty after migration. Activation is a separate reviewed operation; no ChatGPT scheduled task is required.

## Preparation validation

The additive migrations were applied to staging on 10 November 2026 (versions `20261110203307` and `20261110205149`). Settings and delivery ledger remain empty. Local executable PostgreSQL tests cover access isolation, authorization revocation, date windows, amount/credit allocation, settlement and claim deduplication. Mail transport tests use synthetic recipients and mock SMTP, including partial BCC acceptance and sender/copy validation. No real mail is sent from staging.
