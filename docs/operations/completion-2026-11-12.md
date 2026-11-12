# Open-item completion — 12 November 2026

## Included changes

- Integrate the Floraweg contract-signing milestone from #301 into the current private presentation, preserving all 45 protected design images and the existing gallery. The milestone uses the already-public article photograph, its full proportions and captions in all 24 languages.
- Apply the requested About positioning corrections in every language. Keep the newer article card below the three About case studies rather than reintroducing the superseded introductory link from #301.
- Include the three service-page selections from #305: Amsterdam/IJmuiden/Ibiza for Real Estate; Ter Apel/Alicante/Heiloo for Consultancy and Private Capital.
- Replace the Action Center's inaccessible outbox read (#286) with an active-admin-only aggregate. A private definer helper verifies the current identity and active administrator role; its exposed wrapper is invoker-only. Neither function returns recipients, payloads, IDs or error messages. Table privileges remain unchanged. Unavailable or invalid counts remain unknown in both views.

## Verification before release

- All 848 automated tests passed, including PostgreSQL role tests against 1,201 failed messages, denied anonymous/client/inactive access, revocation and unchanged private outbox records.
- Production-mode Next.js build, TypeScript and dependency audit passed (zero audit vulnerabilities).
- The additive function migration was rehearsed in a rolled-back Staging transaction, applied only to Staging initially, and verified using the authenticated database role. Anonymous execute and authenticated table SELECT remain denied. No new function-specific security-advisor finding was reported.
- Actual browser authentication is separate from these role tests. The owner confirmed that the published Floraweg presentation looks good during this session; that visual acceptance is complete.

## Investigated, not silently closed

- #270: the latest 24-hour production log query returned 36 log entries for the known Server Action error. Multiple entries share each request ID, so they are not 36 independently confirmed failures. The latest sample hits four marketing pages in roughly two seconds. The introduction form submits to `/api/intro-calls`; the sample POSTs target the page URLs instead. This pattern is compatible with automated or obsolete requests, but provenance and customer impact remain unverified. No public forms or Server Actions were disabled.
- Historical Property Operations drafts (#143/#145 and #154–157) overlap later production functionality but also contain unfinished scanner/retention work. Do not merge or delete them wholesale. #178 remains a historical design package; current reporting and export work must be judged from its later implementations.
- #187/#238 still need a supported authenticated file sender and approved malware-processing service before direct transfer can be accepted. Existing manual archive functionality is a separate workflow.
- Auth-mail template installation, backup restoration, provider account/security settings and authenticated role/browser acceptance require appropriate provider or application sessions. MFA remains explicitly parked by the owner.
- Malta/Andorra/Portugal/Switzerland choices and campaign activation remain product/content decisions, not implicit releases.

No real bank classifications, invoice issuance, financial approvals, outgoing mail, scanner transfers or new user access grants are performed by this source change.
