# Owner-confirmed customer completion and reporting exclusion

Confirmed name variants can be linked through controlled administrative writes with an explicit owner-confirmed basis and authorization reference. Original names remain unchanged; the detail page displays the correct confirmation basis. Exact-name links retain their unique-match checks.

Owner-requested removal of an unpaid invoice uses a separate immutable exclusion record. The original source is retained and invoice numbers remain protected. Active archive queries, exports and cockpit reporting omit excluded records; the excluded selection and direct detail remain available for reference. This does not create a credit note, payment event, account login or invitation.

The active cockpit view runs with security_invoker and the underlying active-admin RLS. Application roles have no write permissions on exclusions or customer associations. Tests cover the confirmation basis, active/excluded totals and CSV labels, original preservation, permission denial and invoker-view isolation.

344 tests passed. A complete rollback rehearsal of the authorized changes produced 126 linked active records and one excluded record, with actual-source report, CSV and cockpit reconciliation. New records contain only source-backed names and customer types. No inferred contact details or legal-company associations.
