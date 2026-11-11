# Floraweg private design presentation

The March 2026 gallery contains 45 selected design images. Image bytes are not part of Git history or the public deployment directory. The gallery metadata records dimensions and labels; a server manifest contains byte lengths and SHA-256 fingerprints.

Images are retained in the private `mzs-private-project-visuals` bucket under `amsterdam-floraweg/do-2026/`. This bucket has no `anon` or `authenticated` Storage policies. Only the server service identity can read objects; browser users cannot generate signed sharing URLs.

`/api/project-visual/[slug]/[file]` checks the current verified session, active profile, active project, explicit project grant, and a grant to an active offering of that same project before initializing privileged storage access. It serves only manifest-listed files whose size and SHA-256 match. Responses and failures disable browser/CDN caching, do not redirect, and restrict cross-origin embedding. Every gallery image disables the shared Next.js optimizer so requests carry the viewer's session cookie.

An expiring, capability-protected import function accepts only the approved filenames, sizes and hashes. It writes without upsert, reads each retained file back, and is disabled after the verified import. It does not grant project access or change other project documents.

Verification covers logged-out and expired sessions, inactive accounts, missing/revoked project and offering grants, wrong project names, traversal, backend errors and corrupted bytes. Client, partner and admin success cases require the same explicit access checks as the private project page. Remote checks must also confirm that public and unauthenticated Storage requests fail and the temporary importer is disabled. Authenticated visual browser acceptance remains a separate check.

Previously published images on public articles are outside this update. This change must never place the new design images into `public/` or commit them to the public repository.
