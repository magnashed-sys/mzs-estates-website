# MZS Group email preparation — 24 October 2026

## Prepared assets
- Open preview.html locally in a browser to inspect 18 isolated examples: confirmation and recovery in en, nl, es, ru, de, it, fr, pt-BR and ar. All links in these examples are disabled. No recipient details or real tokens are included.
- subjects.json contains proposed subject copy per language, extracted from the translated HTML titles. It is a review catalogue, not an executable Supabase configuration. Verify localized subject selection in Staging before installing; translating an HTML title does not configure the email subject.
- Source templates: ../mzs-confirm-signup-email-template-all-languages.html and ../mzs-staging-reset-password-email-template-all-languages.html.
- Arabic has RTL; brand and contact identifiers retain LTR. The existing contact mailbox info@mzsgroup.eu is preserved pending verification of the actual sender/support configuration.
- Account activation, project/Capital assignment and rental lifecycle email translations already reside in application code. Do not install those as Supabase Auth templates.

## Static preparation checks executed
All 18 branches extracted successfully. Each branch has its matching HTML language; both Arabic branches specify RTL. All nine confirmation branches retain ConfirmationURL. All nine recovery branches retain RedirectTo plus token_hash and type=recovery. This checks template source, not live token acceptance or inbox delivery.

## Staging installation and acceptance
1. Export and securely retain the current Auth template bodies, subjects, Site URL, redirect allowlist and enabled notification types. Compare them with these repository drafts before replacing any setting.
2. Confirm confirmation uses the application's existing signup redirect. Recovery requires a query-free RedirectTo pointing to the existing /auth/confirm handler; do not append this template's query to an already queried URL. Check the actual application call and deployed configuration.
3. Install confirmation/recovery bodies only in the isolated Staging project. Use saved preferred_language, with English fallback for missing/unsupported values. Language metadata must never confer access.
4. With an explicitly authorized controlled inbox, test each language, mobile and desktop, Gmail/Apple Mail/Outlook, dark mode, long headings, Arabic direction, and translated subjects. Record message type, locale, client, environment and result without storing tokens.
5. Confirm signup email verification does not bypass inactive-account/admin approval. Test valid, expired, reused and malformed confirmation/recovery links; changed passwords must respect the existing eight-character minimum. Check environment isolation and existing project permissions.
6. Inventory invitation, email-change, reauthentication and enabled security notification templates before calling all external emails complete. Do not enable unused Auth flows merely to test translations.
7. After Staging acceptance, obtain approval for the exact external Production configuration change and retain rollback copies.

## Boundaries
Prepared only: no Auth settings changed and no messages sent. Existing preview branch settings do not automatically apply to a new branch; this documentation package does not need a deployment. Current live Supabase templates and inbox behavior have not been verified through this preparation.

Reference: https://supabase.com/docs/guides/auth/auth-email-templates
