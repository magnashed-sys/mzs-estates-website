# Accountant handovers

Accountancy → Accountant handovers. Linked from the module directory and each annual administration. EN/ES. The existing entity/year is the period boundary; no new administrations or delivery records are seeded.

The administrator records preparing, ready, handed over, questions outstanding or handover completed, with a mandatory explanatory note. Handed over/questions/completed require accountant or office, actual date (not future), and package/delivery reference. This is an internal manual register: no email, external account access or receipt confirmation is generated. Downloading uses the existing current annual ZIP and never marks it sent. It does not retain a frozen export; keep the delivered copy and identify it in the reference. Current source counts are explicitly separate from a previously delivered package and never imply statutory completeness.

Questions have open/resolved status, optional follow-up deadline, answer and revision. Resolution requires an answer. Completion requires no open questions. An administrator must explicitly reopen a completed handover before adding/reopening questions. Both operations serialize on the annual administration row; UUID locking also prevents cross-year create races. Config changes are immutable audit events with actor, before/after and timestamp. Optimistic revisions reject stale submissions and repeated creates. There is no deletion operation.

Only active Group Admin can read/write. All tables use RLS, application roles have SELECT only, and the public invoker RPC delegates to an explicitly guarded private function. User-supplied actor/revision fields cannot replace the database values. Staff, partner, anon and service-role calls do not gain new permissions. No source records, invoices, payments, hours, tax treatment or existing follow-up tasks are changed. Current completeness checks and existing follow-up counts are reused; source failures show unavailable, never a zero count.

Tests: handover lifecycle, required evidence/date validation, resolution/completion/reopen constraints, wrong-year IDs, stale updates, denied direct mutations and audit edits, live admin revocation, role isolation; server auth before RPC; EN/ES form rendering; invalid selected year and failed annual sources. Staging fixtures are transactionally rolled back. Release adds zero real handovers or questions.

Rollback: revert application links/page and retain additive tables/history. Existing annual exports remain independent.
