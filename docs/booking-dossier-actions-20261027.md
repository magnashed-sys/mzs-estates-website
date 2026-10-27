# Booking dossier actions

Prepared against production 33284f1; preview only.

The dossier groups editing, cancellation/releasing availability, and archive/cleanup. A server-generated cancellation plan identifies normal live reservations, imported confirmations, linked owner stays and blocked dates. Execution rechecks eligibility under a booking row lock and compares a booking/owner fingerprint.

- Live client cancellations reuse the existing audited RPC and notification delivery.
- Imported cancellations preserve original source documents, corrected values and booking amounts. Past imported stays may be corrected only with an explicit reason; completed actual stays should be archived.
- Owner cancellation atomically updates both request and reservation; source links remain.
- Releasing a block records cancelled status, retains the row and frees availability.
- Special cancellations do not generate mail. Pending older change notifications are superseded; sending/uncertain notifications block the action.
- Invoices/drafts and unreversed receipts block cancellation for financial review. No refunds or financial edits are performed.
- All actions require active administrator access. Test bookings keep their dedicated cleanup workflow.
- Owner management links directly to the booking dossier and supports request anchors.

## Validation
Staging migration applied. Transactional rollback checks cover all four cancellation paths, historical source preservation, audit, stale snapshots, repeat cancellation, short reason, receipt blockers, inactive/unauthenticated administrators, and anonymous grants. The live path creates its outbox record only inside the rolled-back transaction; no email was sent. Authenticated mobile/desktop preview acceptance remains required. Production migration has not been applied.

## Release
Apply 20261027093937_booking_dossier_cancellation.sql before publishing the app. Production approval is separate. This is a database expansion: keep the cancelled owner-request state if the application is rolled back.
