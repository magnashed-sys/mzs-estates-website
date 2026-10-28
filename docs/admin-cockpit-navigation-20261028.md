# Admin navigation: Cockpit and eight workspaces

The primary navigation is Cockpit, Bookings, Real Estate, Capital, Relationships, Staff, Accountancy and System. `/admin` still opens the protected Group workspace, now named Cockpit, with Financial Cockpit immediately after its compact title. The repeated module buttons and generic management-register navigation are removed.

Staff owns employee/object access, work visits, reviews, corrections and time reports. Accountancy owns cost concepts, historical weekly statements, externally issued invoice records and accountant exports. Historical employee costs are linked from Staff to Accountancy, keeping billed hours separate from actual time. Real Estate retains properties, units, contracts, legal attribution, maintenance and projects; Bookings retains reservation and owner-stay workflows. Capital and Relationships retain their original protected registers. Member companies remain discoverable in Relationships. The isolated synthetic pilot moves to System with its exact-release guard preserved.

Legacy URLs, filters, dossier actions, financial calculations and database permissions are unchanged. Active-tab mapping handles legacy specialist paths and separates hours/correction queues from maintenance queues. Scoped Capital administrators do not gain Group navigation or access. Mobile navigation scrolls horizontally rather than wrapping into repeated rows; focus and disabled states remain explicit.

Validation covers tab order, active-tab routing, admin denial, existing security tests, TypeScript and a production build with isolated preview configuration. There is no database migration or data import. Visual acceptance in a signed-in owner session is separate from automated route/component checks.
