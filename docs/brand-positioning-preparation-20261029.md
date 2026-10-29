# MZS Group positioning — preparation only

Owner instruction: prepare the approved positioning; **do not publish** while another release is in progress. Keep this branch and PR unmerged and in Draft. No automatic release after the other work finishes; publication requires a later owner instruction.

## Proposed first impression

**Tailor-made solutions for entrepreneurs and investors.**

Bringing together consultancy, real estate and private capital to support your ambitions.

*Private. Independent. International.*

Links: Consultancy → /consultancy; Real Estate → /real-estate; Private Capital → /private-capital. Each link retains the current language prefix; existing English paths stay unprefixed.

Dutch headline: **Maatwerkoplossingen voor ondernemers en investeerders.**

## Implementation

- The homepage H1 now explains the audience and proposition. The original three-part slogan remains as supporting text.
- Retains the architectural background, palette, header and footer. Responsive heading wraps naturally, with a fallback for long words. Activity links have visible keyboard focus and 44px minimum height.
- About MZS gains an introductory positioning paragraph before the existing company story. History and activity cards remain intact.
- Consultancy, Real Estate and Private Capital hero introductions address entrepreneurs and investors. Detailed service scope, forms and existing disclosures remain unchanged.
- Home and About meta descriptions also feed existing Open Graph and Twitter metadata. Activity-specific titles, URLs, canonical tags and social images stay intact.
- Copy prepared in all 16 enabled locales: English, Dutch, German, French, Spanish, Italian, Norwegian Bokmål, Swedish, Polish, Lithuanian, Romanian, Russian, Turkish, Simplified Chinese, Arabic and Brazilian Portuguese.
- Existing locale catalogue-size expectations updated from 1,158 to 1,160 for the two new translated messages; all structure and ICU argument checks remain.

## Isolation from the concurrent publication

Started from main commit `294510a2d8c669a5812574069582c3da2a095d5f` (PR #175). Main subsequently advanced with the separate credit-note release, PR #176; this preparation does not include or modify that release.

Branch: `feature/mzs-brand-positioning-preparation-20261029`.

The branch's `vercel.json` disables automatic Git deployment **only for this exact branch**, using `git.deploymentEnabled`. Unspecified branches retain their existing behavior. There are no changes to Vercel project settings, environment variables, production aliases or schedules. The existing cron entries are untouched.

Official reference: https://vercel.com/docs/project-configuration/git-configuration#git.deploymentenabled

No production or hosted Preview deployment, merge, database action, invoice change or outbound message was requested or performed for this preparation.

## Validation

- Offline locked dependency installation completed without dependency changes.
- Full automated suite: **380 passed; 0 failed**.
- `npm run build`: exit 0; generated `.next/BUILD_ID`, prerender/routes manifests and required server files. Used the repository CI's deliberately nonfunctional build-only public key and Staging URL, without credentials for real data.
- `npm run typecheck`: passed.
- `git diff --check`: passed.
- The existing all-locale tests confirm complete translation-key parity, valid ICU messages, public route localization and unchanged protected-route behavior.
- React review: async server component; independent translation calls batched; no new client component or dependency; a labelled navigation landmark; decorative SVG arrows; stable link keys.

## Remaining before publication

The managed local preview launcher appends Vite-specific `--host` and `--strictPort` flags to `next dev`, which rejects `--host`. Therefore **no browser screenshot or desktop/mobile visual acceptance is claimed**. The working application and production hosting settings were not altered to work around the preview infrastructure.

After separate owner authorization for the next step:

1. Reconcile this branch with current main, particularly any concurrent public-page or catalogue changes.
2. Arrange a permitted local/isolated visual review. For a hosted Preview, explicitly enable this branch's deployment first; do not merge it to main to obtain a preview.
3. Check homepage and About on desktop and 320/390px phones; English, Dutch, long German/French text, Arabic RTL and Chinese wrapping. Check keyboard focus, all three localized activity links and the language switcher.
4. Review translated editorial wording; automated checks establish completeness and syntax, not native-speaker approval.
5. Repeat the required PR checks on the final merge candidate and obtain the owner's publication instruction.
