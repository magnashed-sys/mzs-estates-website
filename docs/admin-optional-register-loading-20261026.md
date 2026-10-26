# Admin performance round — modular loading (Staging)

The central Bookings repository search is now available in Production via PR #103. This Staging-only follow-up optimizes the legacy Group Admin dashboard without modifying booking, invoice, account, company or project records.

## Verified bottleneck
Previously the 50 KB+ `app/admin/page.tsx` client shell always fetched seven registers as one Promise.all batch before showing *any* Group Administration view. Three of these — `mzs_member_companies`, `mzs_member_contact_details`, and `offerings` — are used exclusively on specialist relationship or project views, not on the financial cockpit/Bookings landing. It also eagerly imported several heavy management components.

## Changes
- Core dashboard verification still requires a valid active admin account, then loads access requests, invitations, member profiles and project overview. Existing completeness checks and hard error states remain.
- Company affiliations and contact details load only when opening **Companies** or **Relationships → Accounts**. Loading and error states explicitly prevent stale/empty data being mistaken for a successful result. A dashboard refresh invalidates these loaded caches.
- Project offerings load only when visiting **Projects & Access**, with independent error/loading handling and existing record completeness checks.
- Financial Cockpit, Booking Management, Rental Summary, Group Action Center, and Project Request Approval are dynamically loaded as individual modules rather than eagerly bundled in the legacy shell.
- Once loaded, the detail registers are cached within the current dashboard refresh generation while switching tabs; they are refreshed only following an explicit user refresh.

## Security/operational boundaries
This is a front-end fetch and bundle-loading refactor only. No Supabase migration, RPC, RLS or role changes. No booking or loan changes, no email generation, no invoice issue. Active admin verification still precedes all reads, and individual Supabase data policies remain enforced. If a specialist query fails, the UI shows an explicit error rather than incorrectly claiming 'No company' or 'No offerings'.

## Acceptance
1. Sign into the Staging Admin and check Financial Cockpit plus central Bookings navigation and Approvals.
2. Open Relationships (requests and then accounts) and Companies; compare the lists with the existing data and verify details are correctly loaded on first entry.
3. Open Projects & Access and verify offerings, permissions and project links remain unchanged.
4. Use Refresh dashboard on each specialist tab, confirming the data updates and the refresh is not silently suppressed.
5. Open Rental Contracts, the Bookings legacy requests/calendar, and Group Action Center. All should load without navigating to a different environment.

## Next phase
After acceptance, further partition the large Admin client shell into independent protected departmental routes with route-scoped fetches. Keep the canonical `/admin/bookings` and current authorised financial actions intact.
