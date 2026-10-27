# Admin completion round
Owner requested implementation on 27 October 2026.

## First implementation
Booking operations now have an independent guarded route under /admin/bookings/operations. Existing requests, cancellation reviews, calendar and test deletion reuse the established authorization and mutation functions. Test cleanup has a dedicated entry. Bookings retains workspace navigation and returns to the Group workspace.

## Remaining before acceptance
- Replace remaining legacy entry points and extract account approvals.
- Integrate dossier actions and preserve list filters on return.
- Design and test audited cleanup of erroneous non-test records, archive/restore and historical cancellation. Existing test-only deletion restrictions remain enforced.
- Test desktop/mobile, all booking types, availability, financial dependencies, notifications and unauthorized access.
- No production data cleanup or release is included in this first commit.
