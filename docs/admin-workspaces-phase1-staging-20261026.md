# Admin architecture — independent workspaces (26 October 2026)

## Objective
As requested, start separating the large legacy `/admin` client dashboard into independently routed, server-authorized Group, Estates, Capital and Relationships workspaces. Keep Bookings' existing canonical `/admin/bookings` entry, audit history, payments and approvals unchanged.

## Delivered in this Staging change
- `/admin/workspaces/group`: independent Group Cockpit with the existing Financial Cockpit and central Action Center; no eager account/company/project register load.
- `/admin/workspaces/estates`: independent Estates homepage, with **database counts only** for property, unit and lease-contract registers plus links to the existing protected management pages, Bookings and Owner Stays.
- `/admin/workspaces/capital`: independently loads counts of Capital deal dossiers and enquiries, linking to existing protected loan/Capital workflows without opening Estates or Bookings.
- `/admin/workspaces/relationships`: independently loads counts of client/partner accounts, CRM relationships and pending account requests, linking to CRM, onboarding and project-access controls.
- Shared protected layout and navigation with the existing brand; responsive desktop/mobile presentation. Each server route explicitly checks `requireEstateAdmin`, in addition to the layout guard. The routes are dynamic and non-indexed.
- New `New workspaces` link in the existing Admin header. The original `/admin` remains untouched in functionality during the transition. Old URLs, profile approvals, invoicing actions, roles and session policy remain valid.

## Security and data boundaries
- Only active Group Administrators are allowed to access these new routes in the first slice. Existing Capital-only and Estates-only role pilots are not broadened by the new navigation.
- Every register uses database count queries (`head: true, count: "exact"`) rather than loading full sensitive records into the overview. An errored or absent count is shown as **Unavailable**, never a misleading zero.
- No Supabase schema/RLS changes, no feature switches, account or booking edits, no new emails or financial writes.
- The existing specialist routes enforce their own authorizations on entry; links do not grant access.
- This is a Staging-only release pending acceptance. Publishing this branch does not enable the unrelated Finance invoice-issuance workflow.

## Acceptance checklist
1. Sign into the Staging environment as a full administrator, then open `/admin/workspaces/group`.
2. Verify Financial Cockpit and Action Center load using the familiar MZS Group layout.
3. Visit Estates, Capital and Relationships from the shared tab navigation; each should show only its own totals and links.
4. Confirm all linked secured modules work, and the `Legacy administration` link returns to the previous `/admin`.
5. Verify an ordinary client or unauthenticated visitor is denied access (without entering another user's credentials).
6. Compare small and mobile viewport navigation, and check failed fetches do not show fake zero counts.

## Follow-up slices
- Once owner approves: redirect key links from the legacy Admin tab navigation to the new workspaces while retaining URLs for backwards compatibility.
- Extract onboarding approvals and relationship management from the large `/admin/page.tsx` shell, with isolated data fetches and state machines, after a second Staging sign-off.
- Optimize financial reconciliation and booking receipt work without conflating booked revenue and actual receipt.
