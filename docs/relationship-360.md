# Relationship 360°

The relationship register and account dossier now link to an administrator-only overview at `/admin/relationships/overview`. Select exactly one `profile` or `relationship` UUID. Linked CRM people redirect to their account overview; a company remains scoped to its own CRM record.

The overview provides searchable, paginated source links for recorded CRM/company connections, contracts, properties, legal entity property roles, project access, bookings, invoices, supplier costs, loan access and documents. It uses explicit identifiers only. A company's contact account does not establish ownership. Saved contract account identifiers take precedence over a later change to the CRM contact.

An unavailable source is shown as unavailable, never as a zero count. Identical imported/live invoices are counted once; conflicting invoice identities fail the invoice section. Amounts and payment balances remain in their source dossiers. Rental invoice links filter by both contract and invoice.

No database migration, access grant, email delivery or financial mutation is introduced. Existing administrator authorization is checked before identity or linked data is loaded.

Validation: relationship scope, identity validation, invoice conflicts, deep-link intersection, missing-source behavior and canonical person redirects have dedicated tests. All source reads paginate and validate exact row counts using the existing shared helper.
