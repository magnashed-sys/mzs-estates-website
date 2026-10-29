# Credit notes for platform standalone invoices

Authorized roadmap step 4, first source coverage: invoices issued through the platform standalone flow. Existing imported, external, booking and rental invoices cannot be issued new credits through this flow; their tax/source structures require separate integration. Existing imported credit notes remain visible as before.

Start from an issued platform invoice → Create credit note. Enter remaining or partial net amounts per original line and a reason. A frozen preview and draft PDF precede explicit definitive issue. Drafts consume no number; abandoned previews do not affect balances. If another credit is issued, stale previews are rejected. Issued notes are immutable and use the issuer's shared protected numbering sequence; retries do not allocate another number.

VAT is allocated from each original line's recorded net and VAT amounts. Cumulative rounding means multiple partial credits recover exactly the original VAT when the line is fully credited. No inferred new VAT rate. The credit retains the original issuer/customer snapshot and private-issuer branding; PDF has negative amounts, an original-invoice reference and no payment request.

Each credit is fully allocated to its original invoice, same customer and entity. Current balance = original gross − active receipts − allocated credits. Credit rows carry negative sales amounts with zero remaining allocation balance, avoiding double subtraction. Recorded-paid stays actual cash evidence. Overpaid/previously paid originals show a negative customer balance; no automatic refund or cross-invoice credit transfer. The receipt RPC prevents receipts above the new remaining balance. Reminder eligibility and stale-preview checks use the credit-adjusted balance under the same invoice lock.

Unified invoices, current Cockpit balances, receivables, service invoice detail and CSV use these allocations. Accountant ZIP adds `issued-credit-notes.csv`, signed amounts and original invoice references by credit issue year. Cross-year originals are referenced, not reissued. Credits and allocations never become receipt/refund events.

Verification: full 384-test suite, TypeScript and build passed; additional accountant cross-year ZIP case added. Actual staging synthetic lifecycle exercised partial/full credits, repeated issue, receipt cap and export, then rolled back. Security advisors unchanged. Synthetic PDF rendered and visually inspected. Signed-in browser acceptance remains a separate user check. No real invoice, credit, payment, refund or customer mail created by release testing.

Rollback target: main 294510a2d8c669a5812574069582c3da2a095d5f / production dpl_EGeRZKwV2Xo72Ficj9s7zDKySBNz. Retain credit tables and adjusted receipt/reminder guards. IMPORTANT: after real credits exist, rolling back to an application that ignores credits would show incorrect balances; use a forward fix or temporarily disable affected finance/reminder surfaces. Never remove issued credit history. Align the pilot SHA with the deployed application.

Remaining: legacy/external source credit issuance, transfers to other invoices, bank refunds, credit cancellation/correction workflow and initial document delivery. None is inferred or performed automatically.
