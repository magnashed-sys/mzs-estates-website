# Accountancy document archive

Administrators can retain annual accounts, tax returns and analysis PDFs per existing legal entity and financial year under `/admin/workspaces/accountancy/documents`. The Accountancy hub links to the register. Filters cover entity, year, document type, review status and title, with counted pagination. New documents use PDF-only uploads up to 20 MiB. This module has English and Spanish UI copy and a persisted preference per administrator; it does not translate the other existing admin modules.

Original bytes are private and immutable after registration. Server-side registration downloads and checks the stored PDF, computes its SHA-256 fingerprint, and rejects duplicates within the same entity/year. Metadata must match an existing private Storage object, size and entity/year/UUID path. Invalid or abandoned uploads may be cleaned up; registered originals cannot be removed through authenticated Storage operations. Revised files are retained as additional documents; superseded records remain available.

Only active full administrators may list, upload, review or open these documents. Database RLS and Storage policies enforce the same rule. File routes authenticate independently, issue 60-second signed URLs, and disable caching. Links open in a new tab. Review edits use revision checks and an audit trigger; original identity cannot be edited. Audit writes are restricted to a private trigger function, not an exposed RPC. No invoice, ledger, cashflow or VAT-setting mutations are part of this release.

## Verification

- Existing application suite: 390 tests passed including the five new archive validation/database tests.
- Six additional server-action tests passed: authenticated identity, stored-byte hashing, invalid PDFs, duplicates, ambiguous retries, optimistic edits and preference identity.
- Production build/type checking passed.
- Isolated staging migration applied; private bucket and seven table policies verified. Security advisors did not report the new objects.
- Local HTTP integration uses synthetic authentication/data and real Next routes; checks English/Spanish render, filters, detail, signed-file redirects, non-admin denial and anonymous redirects.
- Full browser journey fixture is included in `tests/browser/accountancy-document-archive.cjs`. The local browser binary was unavailable; use `MZS_ARCHIVE_HTTP_ONLY=1` for the verified server integration path. Do not claim the full browser journey ran.

## Deployment and retained documents

Apply the additive migration before deploying the UI. Import source documents only into the private Production bucket, checking the entity tax identifier, original byte size and SHA-256. Keep all financial source bytes and import capabilities outside Git. Preserve the pre-release analysis report as its dated original; explain any pre-release archive-status text in its document note. Disable any narrowly scoped one-off import endpoint after verified completion.

Rollback may restore the previous application deployment while retaining the additive tables and private originals. Do not remove the archive or its source files as part of an application rollback.
