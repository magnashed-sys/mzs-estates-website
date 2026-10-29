# Admin English / Spanish

The language control in the `/admin` layout applies to Cockpit, Bookings, Real Estate,
Capital, Relationships, Staff, Accountancy and System, including their specialist pages,
forms, display statuses, confirmation messages and shared staff registers. The archive
uses this same preference. A missing preference defaults to English.

Preferences are stored per authenticated account in `mzs_admin_language_preferences`.
The server action accepts only `en` or `es`, verifies an active profile and writes the
verified user's ID. RLS permits reading, inserting and updating only one's own row.
The small policy migration also permits scoped administrators to save their own
presentation preference; no role, department or document grants change.

Middleware overwrites `x-mzs-admin` from the actual route. The request-local locale
lookup does not grant access. Existing page/action guards continue to enforce access.
Public and client language preferences, invoice languages and notification recipients
retain their existing behavior.

Use `useAdminI18n()` in synchronous components and `await getAdminI18n()` in async
server components. Add application-owned text to `lib/admin/translations.es.json`.
Keep placeholders identical in both languages and interpolate user values without
translating them. Names, addresses, descriptions, original documents and invoice
snapshots remain source data. Pass `locale` to display formatters; keep date inputs,
identifiers, currency arithmetic and persisted values locale-independent.

Tests cover catalog placeholders, all eight navigation destinations, locale isolation,
server-action identity and validation, own-row PostgreSQL policies, and existing finance,
booking and staff regressions. `tests/browser/accountancy-document-archive.cjs` supports
`MZS_ARCHIVE_HTTP_ONLY=1` against a local build and a synthetic Supabase fixture, including
the real language server action and persistence across administrative workspaces.
