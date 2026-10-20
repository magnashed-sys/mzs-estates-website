# Capital client summary — limited client access

Owner approved Production release on 20 October 2026 after Staging acceptance.
Only the designated test client receives the two explicitly selected dossiers;
real relationship access still requires the owner to select the recipient.
The existing owner-designated Staging test client has explicit access to the two
Staging source dossiers: borrower for the loan provided, lender for loan received.
No account is promoted and no real relationship is granted access.

Clients see only display label, assigned perspective, original loan amount,
start/end dates, confirmed interest dates/amounts and total received/paid interest.
An unknown end date remains Not confirmed. Scheduled amounts are not receipts.
Principal payments and voided payments never contribute to interest totals.
No internal notes, counterparties, documents, evidence references, audit, planned
schedule or editing actions are exposed. The database RPC derives the caller from
auth.uid(), accepts no target user/deal identifier and returns an explicit field
allowlist. Base table RLS remains full-admin-only. Active per-client grants can be
revoked without deleting audit; inactive accounts and anonymous callers fail.
The read-only definer projection is necessary to avoid giving clients raw-table
read privileges; it has empty search_path and no public/anon EXECUTE grant.

Validated: TypeScript and Next.js build; transactional Staging SQL tests for field
allowlist, partial interest total, principal/void exclusions, both perspectives,
raw table denial, self-grant denial, other client isolation, revoked access,
inactive profile and anonymous denial. Synthetic fixtures roll back.

Owner acceptance: sign in with the designated Staging client and open Private
Capital > Your Capital dossiers. Check both perspectives, dates, empty payment
history and EUR 0 confirmed totals. Real dossiers have no confirmed payments yet.
Do not manufacture payments to make a populated screen. Before production,
review chosen real recipient/party role per dossier and explicitly approve release.
No automated mail is sent. Existing Staging Auth SMTP isolation exception remains.

## Production release — 20 October 2026

The owner accepted inline dossier cards above the enquiry forms and role-specific
interest totals. Production migration and test-client-only grants applied.
Read-only database verification: test client sees two allowlisted summaries;
another active client sees none; raw dossiers/documents/audit and anonymous RPC
remain denied. Production and Staging user UUIDs were resolved independently.
No financial records, documents, passwords or existing account roles changed.

The inline cards load via a same-origin no-store API that checks exact deployment
and database pairing, authenticated user and active client/partner role before
the existing caller-scoped RPC. No client-supplied target identity is accepted.
12 Node security tests, TypeScript and build passed before release.
Rollback target: dpl_69WDMKxWqWjhcKXEwuvxv2u188e5 (main 241fc95d119e45a7ac7c513f876bc3718322c766).
If access must be suspended, deactivate only the newly granted client-access rows
as well as rolling back the app: app rollback alone does not disable direct RPC.
Retain audit and financial data; no destructive rollback. The previously confirmed
Production backup was 20 October 2026 01:17:17 as displayed by Supabase; no restore
was performed. Owner Production browser acceptance remains a follow-up.
