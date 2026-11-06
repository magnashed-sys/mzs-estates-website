# Bank imports and private current accounts

Open Accountancy → Year administrations → the entity and year → Bank & current account.

1. Register each bank account once for the correct SL, using its IBAN and the evidenced bank balance immediately before the first transaction on the opening date. Start with the earliest period being imported. Do not invent an opening balance.
2. Upload UTF-8 CSV or XLSX (first sheet, header in first row, no formulas/macros). Maximum 512 KiB / 1,000 rows per file; split larger annual exports into non-overlapping periods. Select separators and dates, map columns, and review signs and totals before confirming. A positive amount is money received by the SL. A negative amount is money paid by the SL. Only EUR is supported.
3. Use either one signed amount column or separate positive debit/credit columns. A unique bank transaction ID distinguishes genuinely identical movements. Exact files and identical overlapping rows are blocked; nothing is silently skipped. Review the bank's first real export before processing the complete year.
4. Allocate bank transactions to existing supplier or sales invoices, a private person's current account, or an item still requiring explanation. Split one movement across several allocations; partial payments and invoices from earlier years are supported. Cross-entity links and over-allocation are rejected.
5. Select the existing private-person relationship. Record its evidenced opening current-account balance once, including zero only when supported. Positive means the SL owes the person; negative means the person owes the SL. Private-to-SL deposits increase the balance; SL-to-private payments decrease it. A supplier invoice paid privately increases the SL's debt to that person. Documented adjustments require an explanation. Opening entries are retained; corrections are separate documented adjustments.
6. Corrections retain history. Reverse an incorrect allocation with a reason. To void an import, reverse all active allocations first; the original remains retained. A corrected import may then be submitted with a new request ID.
7. Download the normal annual accountant ZIP. Its bank/ folder contains original files and hashes, bank transactions, allocations/corrections, account balances, current-account balances and unresolved items. The manifest includes these files. Bank originals are limited to 16 MiB per annual download; a failed complete export does not return a partial package.

## Accounting boundary

Bank allocations are evidence links, not new invoices, payments, expenses, income or statutory journal postings. Existing receipt/payment registers remain intact and are exported separately. The accountant must reconcile their overlap rather than add the amounts together. Historical imported invoices can overlap issued invoices. A fully allocated bank register does not prove complete statement coverage. Check all accounts, periods, opening/closing bank balances, outstanding invoices and missing supporting documents.

The Spanish 551 account is suggested only when the counterparty is a shareholder/director, subject to accountant confirmation. Loans, capital contributions, dividends, interest, related-party terms and tax treatment are not automatically classified or calculated. This package supports annual preparation; it is not a tax filing.

## Verification

Unit and database tests cover signed cents, CSV quoting and dates, XLSX numbers, formula/archive limits, exact source retention, duplicate imports, partial allocation and invoice caps, cross-entity denial, current-account signs, corrections and RLS. Staging RPC tests use a rolled-back transaction. No real bank file has yet been provided; bank-specific header/layout validation remains part of the first import.
