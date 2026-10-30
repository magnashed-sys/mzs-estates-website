# Cockpit layout and loading

The cockpit now mounts exactly one section selected by URL: finance (default), requests/tasks, or arrivals/planning. Links disable prefetch so unopened sections do not load private registers. The global module directory is collapsed and remains available on the cockpit; the duplicate expanded directory is removed. Operations refresh preserves the selected section.

Financial views: summary, monthly outlook, current invoice balances, historical invoicing, detailed report/export. Summary/outlook share one lightweight request. Invoice balances and historical invoices load only when selected. Existing API requests without a detail parameter retain full behavior. The summary skips both the historical archive read and the consolidated invoice register (which itself reads multiple sources). Financial calculations and entity attribution are unchanged. Results remain private/no-store, require active admin, and fail closed on source errors. Export requires a full result.

Fix: a duplicated current-invoice panel was nested inside every monthly table row, causing invalid table HTML and repeated content. Rows now contain only header/data cells. One balance panel lives in its dedicated view. Charts expose all three series amounts as real text instead of relying on mouse-only title tooltips. Responsive layouts constrain cards, controls and chart labels; wide reports scroll within a focusable labelled region instead of widening the whole page.

Tests verify actual rendered table structure, twelve rows, no duplicated balance panels, touch-accessible values, per-view source loading, invalid and unauthorized requests, and one mounted cockpit section at a time. No database or financial mutations.
