# Specialist admin routes
Continuation after live PR #124. No database or permission changes.

- /admin is now a small server-guarded redirect entry. Old tab links resolve to canonical routes and retain other query parameters.
- /admin/accounts, /admin/member-companies, /admin/projects and /admin/system independently verify Group Administrator access, then reuse the existing approval/edit workflows in AdminPanels.
- Data loading is scoped: account approvals need requests/invitations/profiles/project choices; member companies need member profiles and lazy company/contact details; project overview needs projects and lazy offerings; System loads no business registers.
- Specialist screens share workspace navigation and preserve action/review locks. Core business mutations and email actions are unchanged.
- Group overview retains the established three-month arrival summary with direct booking/operation links.
- Shared AdminPanels remains a client module; this is route and data-load extraction, not a complete per-panel bundle split.

Validation: legacy route mapping/filter preservation and invalid-input tests; active-admin server guards and existing regression suite. Authenticated browser workflows remain an acceptance step. Production is unchanged by this branch.
