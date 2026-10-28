# Historical invoicing in the Financial Cockpit

The owner authorized historical reporting for 2026 only. The 2025 archive remains available for reference and is excluded from this integration.

The authenticated cockpit API loads complete, counted pages of immutable 2026 invoice headers using the existing active-admin RLS policy. The financial report attributes each record only through its issuer ID. The UI and CSV expose signed invoice-date monthly and annual totals, including credits, gross/net amounts and source settlement/open snapshots.

These are invoiced values, not recognised revenue or bank transactions. Source payment dates and snapshot time are unknown. Deposits and invoices covering future service periods still need classification. Historical values are never added to contract forecasts, current platform receivables or dated cash receipts, avoiding double counting. No database schema or data writes are required.

Validation covers scope exclusion, issuer filters, signed credits, zero records, duplicate and invalid source rejection, full pagination and failures. The actual 2026 dataset is checked separately against the imported controls. Authenticated visual acceptance remains in the owner's session.
