# Admin completion — second slice

PR #123 is live. This continuation is not released.

- /admin and old overview/Estates/Capital/Bookings tabs route to the canonical workspaces; account/project/system tabs remain accessible.
- Booking operations and test cleanup are accessible from the Action Center and dossier.
- Cancelled, declined and completed confirmed bookings may be archived/restored. Active reservations and unavailable blocks cannot be archived.
- Permanent erroneous-record deletion requires cancelled/declined status and no FK-linked history. All dependencies, including cascading ones, are checked. Payments, invoice drafts, imports and audits block deletion. A cleanup audit snapshot is retained.
- Cleanup uses a locked booking and fingerprint to reject stale changes. No booking UPDATE or customer notification occurs. Archive affects only the central working list; calendars, source operations and financial reporting retain original records.
- Search v2 filters archive state BEFORE paging and computing exact totals. Original search remains compatible for older code.

## Validation
Staging migration 20261027090205 applied. Rollback fixtures passed: archive/restore search, unchanged source booking, stale rejection, cascading-FK protection, audited deletion, active reservation protection, unauthorized calls and grants. Security advisors report no findings for added tables/functions.

## Before release
Apply the reviewed migration to Production before deploying this code. Owner preview review and authenticated end-to-end browser checks remain required. No production records have been deleted, archived or changed by this work.

## Remaining round
Extract onboarding/account/project tabs from legacy client shell; finish consistent navigation on specialist screens; preserve list filters after dossier edits; complete owner-stay/availability and historical cancellation workflows; desktop/mobile end-to-end acceptance. This slice does not provide arbitrary deletion of imported or financially linked records.
