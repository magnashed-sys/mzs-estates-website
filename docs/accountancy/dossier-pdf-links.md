# Dossier PDF attachments

An administrator opens **Manage PDF attachments** on a supplier cost or **PDF attachments** on a property. Upload the original into the existing private archive, then select **Link PDF**. The two steps are explicit: a successful upload does not claim that the association was saved. Existing originals can be linked without uploading again, including a combined water/sanitation PDF supporting multiple invoices.

The archive now classifies supplier invoices and purchase deeds. Cost attachments must match the invoice entity and fiscal year. Property attachments require a dated property/entity association covering the document date (or an overlapping fiscal year when no date is recorded). The server and database independently require an active full administrator. Signed downloads retain the existing 60-second expiry and no-cache response. No public URLs are created.

Links can be removed only with a reason. The original and prior association remain retained, with actor and time in append-only audit events. Removed or superseded attachments do not satisfy a missing-original exception in the annual package. Financial draft amounts, review status, VAT treatment and payment state are not changed. The accountant export includes `supplier-document-links.csv` with each current association and original SHA-256; PDF bytes are still not bundled into the export.

This is manual archiving of reviewed source documents, separate from the disabled production OCR/scanner workflow. It neither enables that workflow nor creates automatic supplier accounts. No tenant PDFs or credentials are included in Git.

## Deployment

Apply `20261029164826_accountancy_dossier_document_links.sql` before deploying the UI. It is additive except for widening the allowed archive categories. Rollback can restore the previous UI while retaining originals and associations. Do not drop retained records.

## Validation

- 435 tests passed, including PostgreSQL tests for role isolation, entity/year mismatch, property association, shared originals, duplicates, removal/relink history, superseded rejection and retained storage.
- Next.js production build and TypeScript checks passed.
- Migration applied to isolated staging; inspect grants, RLS and advisory results before release.
- No authenticated graphical browser test was available in this session. The UI upload/link/download journey still needs a signed-in acceptance check; automated database and server-action checks do not replace that check.
- The previously supplied real PDFs are not uploaded by this code change. They must be imported into private storage or uploaded through the authenticated archive before any link is registered.
