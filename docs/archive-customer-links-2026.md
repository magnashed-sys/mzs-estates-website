# Historical invoice customer associations

The owner requested linking 2026 source invoices to central customer records. Associations preserve the immutable imported invoice data and original customer spelling. The first controlled pass accepts only a unique case-insensitive, trimmed exact name match. Name variants and missing customers remain unlinked for owner clarification; a property's current tenant is never substituted for a historical invoice customer.

A separate admin-readable, immutable association table stores the invoice/customer foreign keys, source and target name snapshots, authorization reference and timestamp. Application roles have no write grant. Inserts enforce 2026 scope and unique exact-name evidence. Referenced customers cannot be deleted. This does not grant customer portal access or send notifications.

Invoice lists and details show associations. Central relationship rows link to a private customer invoice overview with full totals and pagination. Lookup/read failures hide incomplete results. Financial amounts, year scope, bank events and original records are unchanged.

Validation includes PostgreSQL tests for scope, ambiguous names, mismatches, duplicates, name snapshots, FK deletion protection, immutable associations, admin reads and client/anonymous denial; 343 tests pass. A full real-source rollback rehearsal linked 102 records to six existing customers; source names requiring clarification are excluded. Authenticated visual acceptance remains in the owner's session.
