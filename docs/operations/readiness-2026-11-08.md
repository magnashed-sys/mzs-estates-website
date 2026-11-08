# MZS Group — operational readiness and acceptance register

Checked on 8 November 2026. This is a non-binding, read-only release checklist.
Do not use a green build or READY Preview as evidence of an authenticated browser session.
No database migration, staff grant, financial posting, outgoing email, invoice change or Production release is authorized by this document.

## Implemented / independently observed

- Phase 3A scoped Capital administration was merged in PR #10 and released in October. Authenticated Staging and API acceptance results are recorded in that PR; a live authenticated Production owner smoke test remains unconfirmed.
- New rental cockpit, active/ended contract filters and batch receipt UI are merged (#262 and #263). Real signed-in interactive acceptance is not confirmed by the merged PR records.
- Bank import/current-account functionality is merged (#254) and had successful rolled-back Staging database checks. Initial real bank-file calibration and authenticated browser acceptance remain unconfirmed.
- One shared admin header was merged in #264; its isolated rendered and automated tests passed. Full authenticated navigation on physical mobile and desktop remains outstanding.
- The latest checked Vercel Production deployment on main, commit fdd5996 (language menu #268), was READY. A ready deployment does not imply end-to-end approval.
- MZS Staging and Production Supabase projects both reported ACTIVE_HEALTHY at inspection.

## Operational acceptance, in recommended order

1. **Header/access:** use separately authorized Group Admin, Capital-scoped, Partner, Property Manager and Client test accounts; verify route denial, back-navigation and logout in a real session. Never share session tokens or passwords in a pull request.
2. **Rental cockpit:** on Staging verify active-by-default lists, alphabetical addresses, monthly draft preview, invoice sequence, 50/50 unit allocations, partial payment errors and bulk payment confirmation without triggering real ledger mutations.
3. **Accountancy:** complete isolated Staging bank CSV/XLSX preview, duplicate protection, split allocation, reversal and accountant ZIP tests using fictional files. Match the first genuine bank format only after explicit finance approval.
4. **Phase 3A:** complete the signed-in Production owner smoke check without changing requests or role assignments. New department grants require separately approved named identities.
5. **Weekly reports:** verify the first MZS-platform scheduled delivery on Monday 9 November at 07:00 Europe/Madrid from actual delivery/audit evidence. Do not infer delivery from a schedule alone.
6. **Supplier PDF original bridge:** issue #187 and Draft #238 still lack an actual authenticated Staging file transfer with stored-byte readback and approved independent malware scanning. No real originals or provider keys in Preview until data-processing approval.
7. **Capital receipt correction:** issue #89 still requires reviewed allocation/void-and-replacement architecture and finance approval before ledger mutation.
8. **Translations and Auth email:** Draft #58 is a preview/review package; email template and real inbox rendering must be accepted without exposing real tokens.

## Draft dependencies / avoid accidental releases

- #143 and #145: Property Operations pilot Staging acceptance and production safety plan. Retain as Draft until authenticated browser acceptance, recovery evidence and explicit release approval.
- #154 → #155 → #156 → #157: supplier evidence, quarantine, opt-in scanner and retention. Scanner provider, contract, residency, processing consent and real signed-in end-to-end acceptance are missing.
- #238: original PDF sender uses Preview-only disabled flags and mocked vendor/storage tests. It is not a complete native ChatGPT file connector.
- #178: Spanish accountant package is a design specification, not a finished import/export rollout.
- #127: investor/consultancy content preview; not a live campaign or lead collection.
- #2: old Speed Insights proposal; review current analytics before deciding whether it should be merged or closed.

## Observability and known uncertainty

- Production runtime logs inspected on 8 November contained repeated "Failed to find Server Action" errors for POST requests to `/about`, `/private-capital`, `/real-estate` and `/consultancy`. This might be old client assets or automated traffic; user impact and root cause are **not verified**. Check recurrence, grouping and a real form journey before changing routing or Next configuration.
- The new checker is intentionally GET-only and verifies public marketing, login, robots and sitemap HTTP 200 / content types; it never tests POST, API writes, authentication, the database, invoices or private records.
- The checker runs only when its workflow is on the default branch and GitHub Actions schedule executes, or when manually dispatched. A Draft PR does not activate the scheduled monitor.
- An external runner may receive a firewall/bot challenge; distinguish 401/403 network admission from actual user-facing downtime before any escalation.

## Release controls

- For code changes: offline tests + CI, TypeScript/build where relevant, READY Staging Preview, real session-based access checks where required, and source-commit matching.
- For data changes: verified backup/recovery, RLS and authorization checks, staging rollback rehearsal, explicit approval for real data and a separate Production decision.
- Do not automatically close, merge or delete old PRs/branches merely because they appear stale; verify whether they contain unique changes and record the disposition.

Source records: PR #10, #58, #127, #143, #145, #154–157, #178, #238, #254, #262–264, #268; issues #89 and #187; Supabase project and Vercel deployment inspections on 8 November 2026.