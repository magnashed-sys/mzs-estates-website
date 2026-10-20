# Capital client summary — Staging pilot

Preview only. No production migration, merge or real relationship access approved.
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
