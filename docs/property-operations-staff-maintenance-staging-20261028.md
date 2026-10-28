# MZS Group — Staff & Maintenance — Staging (28 October 2026)

**Scope:** Draft PR #143, isolated Staging database only. No Production changes.

## Catherine account verification (READ ONLY)

An existing active **client** profile matching Catherine has been confirmed in **MZS Production**. There is currently **no corresponding Catherine profile in Staging**. Personal email, profile ID, chat history, employment data and other identifying records are **not** included in the repository or copied to Staging.

The new staff module adds narrowly scoped property permissions to existing active client/partner profiles, **without modifying `profiles.role`**. On a future, separately approved Production rollout, administrators can choose Catherine's **existing active account** and assign only the appropriate physical property or properties after the relationship is verified. This is preferable to making her a Group Admin or duplicating her user. No property association was assumed or created.

## New isolated Staging routes

- `/staff` — logged-in active client or partner **with a currently granted, active physical-property scope only**. The narrow directory shows only property IDs, display names, addresses and assigned unit addresses.
- `/admin/workspaces/estates/staff` — active Group Admin dashboard to grant/revoke property scopes with an explicit reason, review scopes, visit entries and maintenance tickets.
- Estates Workspace contains a link to the new admin route.

## Security design and data handling

- Permissions use a new append-only `mzs_ops_staff_scope_events` log keyed by active profile and physical property. Grant/revoke actions are administrator-only. The most recent event determines access, allowing revocation without rewriting history.
- A private, callable RLS helper checks **authenticated profile ID, active state, client/partner role and latest grant event** before each staff write. It is *not* an extension of `mzs_property_partners` owner-stay permissions.
- The staff portal uses narrow security-filtered property and unit directory views. The existing physical property tables' RLS remains Group-Admin only, ensuring staff cannot read owner details, tenant identities, notes, legal entities or financial dossiers.
- `mzs_ops_staff_visits`: one row **per actual visit**, with actual calendar date, actual minutes, property, optional matching unit, work category and factual description. Written only by the currently assigned, logged-in staff user. Append-only, no edits or deletions.
- `mzs_ops_maintenance_tickets`: property/unit-scoped reported issues with priority/title/description. Only the reporter (while assigned) and administrator can read. Append-only, status is initially `reported` and no work order or invoice is automatically created.
- No employee pay rate, tax, VAT, wages, customer charge, hourly billing rule, bank information or private client record appears in the staff UI.
- Correcting an inaccurate visit or ticket will need a further dedicated audited correction workflow; staff cannot silently overwrite submitted records.
- No source document, photo or user-supplied filename is uploaded through this first Staff & Maintenance slice. Photos require a dedicated private bucket and verified staff-per-property Storage policies.

## Catherine practical pilot / user journeys

1. **After a Production release has been explicitly authorised**, Group Admin selects Catherine's **existing Production client account** in Staff Administration. Confirm her true property responsibilities, then grant only relevant physical properties. This grants no ability to see other clients, lenders or financial balances.
2. She signs into the existing account and opens `/staff`. The UI should show only assigned property/unit labels.
3. Each actual work visit is entered separately. For example, **45 actual minutes remain 45 actual minutes**; an eventual separate *approved billing rule* may later charge 60 minutes, but the staff record is never overwritten. Two visits of 30 minutes each must remain two distinct records.
4. She can open maintenance reports for a property/unit that she is assigned to. Reporting a leaking tap creates a **ticket**, not a supplier commitment, automatic owner email or customer invoice.
5. Admin sees visits and tickets across the managed platform and can revoke the scope. Revocation immediately removes the staff member's access to the property and their own old entries through the staff portal, while admin audit persists.
6. Historical Catherine WhatsApp records are informational until source-by-source reconciliation. **Do not** automatically import or double-invoice Zorgbalans, infer work start/end times or reissue previously prepared invoice 7113.

## Stage acceptance checklist

- [ ] Staging database migration applied only after exact-head GitHub Platform and static security checks pass.
- [ ] PGlite RLS tests: active assigned client/partner sees only assigned physical property and own work, another client cannot read it, unassigned client is denied, direct write to unrelated object/incorrect unit is rejected.
- [ ] Admin grants and revokes independently per property with append-only event; second grant/revoke in same state is rejected.
- [ ] Staff has no SELECT on full physical property or unit tables, no access to financial records, no Admin or Capital privileges.
- [ ] User tests mobile UI with a **separate designated Staging test account**; Production Catherine account remains unchanged.
- [ ] No real staff hours, owner stays, bookings, payments, supplier invoices or Production data are created/altered.
- [ ] Owner explicitly approves any eventual Production migration and selected scope to Catherine.
- [ ] Next steps: manager verification/approval of staff visits, audited corrections, billable duration snapshot per separate approved customer rules, maintenance work order lifecycle, private attachments and cost/recharge references.

**This PR remains Draft and does not publish itself to Production.**
