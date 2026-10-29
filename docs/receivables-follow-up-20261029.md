# Receivables and follow-up

Authorized step 3. Admin-only `/admin/workspaces/accountancy/sales/receivables` reuses the reconciled invoice register. Filter by invoice year, entity, search, age and follow-up state. Exact-cent buckets distinguish due today, 1–30, 31–60, 61–90, over 90 days, missing due dates, unknown payments and credits. Totals cover the full filtered selection, pagination covers customer/entity groups. Credits never offset unrelated balances.

Service/external customer IDs and explicit archive customer links support grouping. Rental and booking snapshots without verified invoice-level IDs stay separate; names and current contract associations are not guessed. Default invoice year is the current Madrid calendar year; older years are explicitly selectable.

Internal notes append immutable revisions with actor/time and next date. Clearing the date requires a new note. Optimistic revisions prevent overwriting another administrator; request IDs make retries idempotent. Notes do not mutate invoices, receipts or accountant exports.

Reminder preview and sending cover linked imported, platform-issued standalone and external invoices with a known positive overdue balance and one registered customer email. Unknown external balances are ineligible. Booking schedules and older rental invoices remain dossier workflows. There are no automatic reminders or batches. An explicit checkbox and send action are required. The current recipient and balance are compared again in the database under the invoice lock used by receipt registration. Archived copies of live invoices and excluded records are ineligible. Archived balances remain snapshot-based; the UI requires checking recent receipts.

Each mail request and worker result is immutable. Only the trusted service worker can report the result. Pending/uncertain results block retries; all attempts impose a 24-hour cooldown. A request accepted by SMTP is not confirmed delivered/read. Staging uses stream capture, never SMTP. Production inherits the existing invoice-mail environment gate and SMTP credentials. The sender display name and footer use the legal issuer, including private issuers. The original invoice is referenced without a fabricated attachment or payment fee. Reminders do not change invoice/payment status.

Validation: automated age boundary, identity separation, stale revision, duplicate request, stale recipient/balance, unknown balance, excluded archive, settled invoice, RLS/role and immutable-history tests. Actual staging transaction exercised synthetic note/claim/worker outcome and rolled back all fixtures. Stream transport capture verifies template and result write without external delivery. UI rendering/auth order tested; authenticated browser acceptance remains a separate user check.

Rollback: previous application fbf703ed13ea722575b8ea8ffb53d125ad330dc9 / production dpl_9GVvTeiSV6CtHhAqFWqH3LY4bPGi. Retain additive tables/functions and audit data on application rollback. Align pilot release SHA with the chosen application release. No source invoice or payment migration is needed.

Remaining: invoice-level verified identities for legacy rental/booking reminder delivery; operational review of uncertain delivery outcomes; service invoice initial email delivery (distinct from reminders). No reminder was sent to a real customer during release testing.
