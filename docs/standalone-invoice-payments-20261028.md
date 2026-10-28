# Standalone invoice payment registration

Administrators can open standalone invoices from Accountancy > Invoices and record an actual EUR bank receipt with amount, date and reference. Partial receipts reduce the remaining balance; full settlement becomes Paid. Corrections append a reversal with actor, timestamp and reason, preserving the original receipt. Reversals do not initiate refunds.

Without active receipts, the payment state remains unknown, including after reversing every receipt. Original externally issued invoice snapshots and imported invoice archives remain unchanged. CSV and accountant ZIP exports include the separate receipts and reversals.

## Integrity and access

The additive migration creates empty, immutable receipt/reversal ledgers with admin-only RLS reads and no direct client DML grants. Private write functions check active administrators, lock the original invoice row, reject overpayments and duplicate active references, and support idempotent request retries. Public wrappers use SECURITY INVOKER. No customer email, collection, source import, or real payment posting is part of this release.

## Verification

Local production build and full automated suite; focused coverage includes rendering, authenticated server actions, exact cents/status/CSV, complete RPC reads and accountant export events. PGlite applies the actual migration and verifies admin/client/inactive/anonymous permissions, immutability, retries and reversals. Staging synthetic SQL exercised partial/full receipts, duplicate retries, overpayment rejection, reversals, replacement references and exports, then rolled back all fixture data. Staging security advisors gained no new findings. Production DDL rehearsal succeeded and rolled back. Authenticated browser interaction was not exercised; no browser session was created.

## Deployment and rollback

Apply the tested migration before the application release. Confirm both ledgers are empty and the existing invoice values unchanged. Publish the reviewed commit after CI and staging preview checks. Update the production pilot release SHA and rebuild before production alias verification.

Prior production deployment: dpl_4mJhxQdLpSptxDRqjgg2uniBBSFK (09c30b9b0c7cde87e0f515916b9bb80adeb3e0dc). A UI rollback can retain the additive schema and receipt history; never drop recorded payment evidence. The older UI does not display the new receipts, so any rollback must explicitly communicate that limitation.
