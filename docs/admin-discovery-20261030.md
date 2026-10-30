# Admin navigation optimization

The owner requested a full admin usability review and authorized production after testing. Auth confirmation/recovery provider templates remain deferred.

This release adds a bilingual searchable module directory on the Cockpit, with a compact expandable entry on every other admin page. All 33 destinations resolve to existing pages, including the recent purchase batch upload, accountant packages, weekly hours and Zorgbalans workflows. Existing page authorization remains authoritative. Search is local and causes no API queries; directory links disable speculative prefetching.

Weekly time approval and Zorgbalans now correctly retain the Staff navigation selection. Staff hub copy for those recent additions is completed in English and Spanish. The directory uses the existing dark/gold styling, visible keyboard focus, labelled filters, live result counts, empty-state recovery and bounded scrolling.

Bulk action review: existing multi-PDF intake, weekly multi-visit approval and scoped accountant packages are exposed directly. The user first chooses scope and reviews records inside those modules. No new automatic invoice issue, payment posting, reminder sending, role granting or deletion is introduced. Further batch mutation work needs per-record eligibility, explicit selection totals, idempotency, partial-failure results and audit evidence before implementation. Bank reconciliation remains deferred.
