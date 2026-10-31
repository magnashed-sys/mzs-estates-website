# MZS Insights

The content studio is available to active administrators at `/admin/insights`, also listed in the admin module directory. It supports all 24 existing site languages. No articles or translations are created automatically.

Create a draft, choose its subject and language, and enter a unique slug. Use blank lines for paragraphs, `##` / `###` for headings, and `-` for lists. The preview renders exactly this supported text syntax; arbitrary HTML is escaped. Public HTTPS sources are separate fields. Do not copy confidential documents, project dossiers or signed download URLs into articles.

Each translation has its own title, summary, body, author, SEO fields and publication state. Add a translation from **Language versions**. The editor does not copy text into another language. Article identifiers group translations; language and group are immutable after creation. Slugs lock when publication is enabled, including scheduling, to protect existing URLs.

**Published / scheduled** makes the version public at its publication timestamp. The editor displays the browser timezone and sends UTC. The list displays Madrid time. Reads always evaluate the database clock and do not depend on cron or a rebuild. Saving edits to an already published version changes it immediately. Draft and archived versions are private; archived versions can be restored through the editor. Concurrent changes are rejected using the stored revision. Every write records an admin-only audit snapshot.

## Search discovery and navigation

The owner has enabled search discovery. `INSIGHTS_DISCOVERABLE` in `lib/insights/model.ts` is true: the 24 localized overview pages and published articles are included in the production sitemap and are eligible for search indexing. Filtered overview URLs and previews remain noindex. Drafts, future publications and archived versions remain private and excluded from the sitemap.

There are still no links from the existing public menus, homepage or footer to Insights. Adding public navigation requires a separate owner request. Article canonical URLs and hreflang include only available published translations; localized overview pages link their equivalent language versions in metadata. Enabling indexing permits search engines to discover content; it does not guarantee inclusion or ranking.

The existing consent-based Google Analytics integration records public article URLs/language and successful introductory-call conversions. The existing public Vercel pageview integration includes article routes. There is no new analytics service or separate reporting dashboard.

## Editorial images

The editor offers the reviewed image collection in `lib/insights/images.ts`, with a required alternative description in the article's language. `cover_image` and `cover_alt` are stored and audited with the article. The responsive overview cards, article header and text preview display the selected image without a visible caption, as requested by the owner. Article Open Graph, Twitter and structured metadata use the same approved asset. Unlisted paths and arbitrary external images are not rendered. The first three assets are optimized WebP editorial images created specifically for these articles; their original files remain in the content package.

Apply `20261031004357_insights_cover_images.sql` before releasing the image-enabled application. This additive change keeps existing drafts and audit records intact. The source URL filter also accepts the official Generalitat Valenciana procedure URL with its single numeric `id_proc` identifier; credentials, additional parameters and signed/private links remain rejected.

## Verification and deployment

Migration: `20261030234137_mzs_insights.sql`. Apply to staging first, then production before deployment. The schema is additive. Public reads use a cookie-free publishable-key client, so even signed-in administrators cannot expose drafts through public pages. The ordinary authenticated Supabase client and active-admin checks protect administration and writes. No service-role key is needed.

Run `npm run typecheck`, `npm test`, and a preview build against the isolated staging project. `tests/insights.test.mjs` includes actual PostgreSQL execution through PGlite, permission checks for anonymous users, clients, inactive admins and active admins, scheduling boundaries, archive/unpublish behavior, Unicode slugs, optimistic concurrency, immutable URLs, audit permissions, escaping, metadata and localization.

Rollback the application deployment if necessary. Preserve both tables and the audit trail; an application rollback requires no destructive database rollback. Browser sign-in to a new preview origin is separate from production sign-in.
