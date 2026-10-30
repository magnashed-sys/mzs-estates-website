# Accountancy follow-up tasks

First follow-up to the completeness center: select up to 30 visible source records per page (server/database cap 50), preview owner/deadline and create in one atomic request. Server recomputes the entity/year source before accepting selected keys. Database validates source membership. Repeated requests retain the existing task and never overwrite ownership or progress. Completed/cancelled tasks remain and can be reopened by an administrator.

Tasks have one persistent identity per administration/source, assignee, due date, status, progress note and revision. Updates use optimistic concurrency and append-only audit snapshots. Existing active administrators or staff with a current property grant can be assigned. Revoked or inactive staff immediately lose access. Only administrators can assign/reassign, edit deadlines, cancel or reopen. Staff can work on or complete their own active tasks.

Admin controls are in Accountancy → Completeness center, below checks. Staff get a link from Property Manager to `/staff/follow-ups`, with their own active/overdue/closed tasks in NL/EN/ES. Titles retain source names and entity/year context. Assigning a task shares that task title/progress, never accounting register or PDF permissions. No emails are sent.

Task completion does not approve invoices, documents, VAT, payments or annual checklist entries. The independent source signal remains visible until corrected. Source signals that disappear do not automatically close tasks. Bank reconciliation and Auth provider mail templates remain deferred. Relationship 360, recurring tasks and accountant handover improvements remain subsequent work.

Verification: PGlite role-based tests cover atomic rollback, idempotency, wrong-year source, assignment eligibility, own-task access, privilege escalation, revocation, inactive accounts, immutable audit and stale revisions. Server-action tests cover live-source validation and unauthorized creation. Staging transaction creates/updates/retries synthetic tasks against existing annual records and rolls all test data back. No real tasks are created by the release.
