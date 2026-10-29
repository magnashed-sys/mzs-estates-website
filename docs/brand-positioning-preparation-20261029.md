# MZS Group positioning and cookie consent — release record

The owner approved publication on 29 October 2026 after reviewing the smaller homepage headline and compact cookie bar on Staging. This supersedes the earlier preparation-only and Staging-only instructions. The owner explicitly requested coordination with another production release.

## Approved presentation

- Homepage promise: **Tailor-made solutions for entrepreneurs and investors.**
- Supporting introduction connects consultancy, real estate and private capital, with localized activity links.
- **Private. Independent. International.** remains beneath the introduction.
- The serif headline is approximately 18% smaller on desktop, with more generous line height and adjusted responsive sizes.
- About, activity introductions and Home/About metadata align with the positioning in all 16 enabled languages.
- A slim bottom cookie bar replaces the large card. Equal Accept/Reject controls and expandable information preserve the existing consent behavior. The homepage reserves the bar's measured height to keep the language footer visible. After a choice, a discreet Cookie settings link remains.

## Concurrent release preservation

The reviewed Staging head was `06e612df05f073e373a87468cb3af21864ddb3ec`. The publication candidate incorporates main through `d4963bb1d78a41efe1384184d4421b8a0d41b3bb`, including the credit-note release and private Accountancy document archive. The merge was conflict-free.

No admin, accountancy, finance or database-migration files differ from that main baseline. This release does not apply migrations, send emails, change data or alter production environment variables. Recheck main and active production deployments immediately before merge; if main advances, include the newer changes and rerun relevant checks before release.

The exact feature branch remains excluded from automatic Git deployments in vercel.json. Main deployment behavior and cron schedules are unchanged. Production must be built from the integrated main commit using production configuration; do not promote the isolated Staging build.

## Verification

- Combined automated suite: **396 passed; 0 failed**.
- Staging browser checks: Dutch and English homepages; compact bar, expanded information, accepting, rejecting, reopening settings, language navigation, visible footer/flags. Google Analytics remains absent on Staging after acceptance.
- Earlier content verification: English About visually; Dutch activity and About endpoints HTTP 200.
- Complete build, TypeScript and GitHub checks on the reconciled candidate before merge; record final commit/deployment status in PR #177.
- Mobile CSS and locale completeness were reviewed. No mobile browser or native-speaker editorial acceptance is claimed.

## Existing issue outside this release

A React #418 warning previously observed on English About was reproduced on the existing production deployment `dpl_8ic3mkN1rW46Sttk1yfRXhgx1cbZ` before this publication. The page renders. This establishes a pre-existing issue, not a clean-console acceptance or a diagnosed cause. No unrelated contact-form changes are included.

PR: https://github.com/magnashed-sys/mzs-estates-website/pull/177
