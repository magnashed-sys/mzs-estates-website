# Recurring property work

Admin → Staff → Tasks & maintenance → Recurring work. Also searchable in the module directory, in English and Spanish. The employee receives ordinary tasks through the existing Property Manager dashboard and keeps its NL/EN/ES controls.

An administrator chooses a property or operational work area, optional unit, an employee with active access, task text, priority, daily/weekly/monthly interval, first deadline, optional inclusive end date and 0–30 days of lead time. New or changed schedules start today or later. Monthly dates are calculated from the original anchor: January 31 → February 28/29 → March 31. Business dates use Europe/Madrid.

Plans can be edited or paused with optimistic revision checks. Existing generated tasks and worked-time entries are unchanged. Resuming skips missed dates and records the number skipped. Changing the schedule resets its future cursor; the unique plan/date key still prevents recreating a previously generated occurrence. Cancelled/completed tasks are not recreated by retries.

The private database worker runs hourly at minute 15 UTC, independent of web requests. Each transaction processes at most 50 plans and one eligible occurrence per plan; overdue catch-up is bounded across subsequent runs. Healthy plans take precedence over plans with an unresolved error. Row locks with SKIP LOCKED and a unique plan/date occurrence record prevent duplicate generation. Task insertion, occurrence creation and cursor advancement share a transaction. Per-plan failures roll back the task and expose a recoverable attention message without stopping healthy plans. Administrators can also generate currently eligible tasks through a guarded RPC.

Only administrators manage/read plans and audit records. Employees retain existing task RLS; no financial access or new staff grants are introduced. The worker is not executable by anon, authenticated or service_role. Its admin wrapper checks the live active admin. The database cron runs as its owner. Task creation uses the last authorizing admin to satisfy existing task guards; automatic/manual provenance is recorded in the immutable occurrence table, and the caller auth context is restored after success or failure. Inactive authorizers and revoked employee scope block creation. Generation creates no time entries, invoices, orders, payments or notification emails.

Release contains zero real schedules. Existing Catherine/Zorgbalans records are untouched. All database test plans/tasks/audit entries are synthetic and either local PGlite fixtures or transactionally rolled back on staging.

Verification: month ends/leap years, DST calendar dates, lead time, inclusive end date, repeated generation, stale save, existing task snapshot preservation, pause/resume, mixed successful/failed plans, revoked location access, inactive authorizer, employee/anonymous denial, private worker execution denial and immutable history. Staging additionally validates actual task guards and that the mail outbox is unchanged. Cron job has no external HTTP requests or credentials.

Rollback: pause/remove only the mzs-recurring-property-tasks cron job before reverting app code if necessary; retain additive tables, history and generated ordinary tasks. Do not delete business tasks to roll back the feature. Production pilot release SHA must follow the selected app deployment.
