# Import a private landlord from an existing person

Under Rental Contracts → Issuing entities, choose Private landlord and use Copy details from person. My profile reads the signed-in administrator's existing profile. Other options reuse person dossiers and client/partner accounts; linked accounts appear once. No account, relationship or access grant is created by importing.

The server action checks the active contract administrator and environment isolation before reading the selected source with the session's RLS client. Only the selected person's name, address and contact columns are returned. A dossier's complete address block takes precedence; an empty dossier address falls back to the linked profile. Address fields are never combined across sources. Legacy unstructured addresses remain readable and can be explicitly replaced with separate fields.

Import fills the form only. Existing form data requires confirmation before replacement. Errors retain the form, and saving remains explicit. Bank and invoice settings stay unchanged and must be checked before saving; person/profile records do not currently store bank accounts. No name- or email-based bank matching is performed. Changes to the source do not propagate automatically to issuers or historical contract/invoice snapshots.

Apply `20261025125646_issuer_person_address_region.sql` before releasing the UI. It adds `region` to the existing issuer-details validator, without rewriting rows or changing permissions. Region is stored separately and included in newly assembled addresses.

Validation: 147 automated tests cover source selection, address precedence, missing records, lookup errors, authorization and region validation. The local browser fixture covers the import and existing rental workflow with in-memory data; no real accounts, contracts, invoices or emails are created. Native iPhone/iPad and live authenticated acceptance remain separate checks. Production release requires owner approval.
