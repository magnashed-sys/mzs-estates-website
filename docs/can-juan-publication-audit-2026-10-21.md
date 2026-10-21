# Villa Can Juan Ibiza — publication and access audit

Audit date: 21 October 2026. Times below are Europe/Madrid (CEST, UTC+02:00).

## Conclusion

The new presentation is deployed to Production and available under the existing
project/offering permissions. A specific owner approval was recovered from the
prior conversation; the initial Staging-only PR description and preparation note
were not updated after that approval. There is no evidence of an unapproved
Production publication of PR #17's presentation. An emergency Staging-only guard
or Production rollback is therefore not warranted on that ground.

This audit changes only documentation and test files on
`feature/can-juan-publication-audit`. No application behavior, financial terms,
database schema, persistent assignment, account, email or Production configuration
has been changed. No merge or Production release is authorized by this audit.

## Approval and release evidence

| Evidence | Finding |
| --- | --- |
| [PR #17](https://github.com/magnashed-sys/mzs-estates-website/pull/17) | Initial scope says Staging only, no Production authorization, visual acceptance pending. |
| Recovered conversation, 20 October 00:47:04 | Assistant presented the revised Can Juan Staging preview, including 343.35 m² total floor area and a separate 40 m² pool, at `https://mzs-group-6qox84bv2-mzs3.vercel.app/admin/group/investment-preview`. |
| Recovered user message, 20 October 00:48:05 | **“super, dit mag door naar productie”**. This directly follows that Can Juan preview; it is not the later generic approval for booking or platform work. |
| Recovered assistant message, 20 October 00:48:09 | Stated intent to publish the approved Can Juan presentation, check PR #17/build, merge and inspect Production. |
| [Merge commit](https://github.com/magnashed-sys/mzs-estates-website/commit/cd66860bad3c67bae580629c49a7f454748bc07c), 20 October 00:48:25 | `Publish approved Can Juan financing and project timeline`. |
| Vercel release records | Two READY Production deployments for that merge: `dpl_9dpaSNDcLP1yeesyCzcSBu1yYfFG` and `dpl_8NwJzDci8HeYJbnkDUESNMPCXpMW`. |
| Active Production domain inspection | `www.mzsgroup.com` resolves to READY Production deployment `dpl_8YomroTwiWFJ4FeJmkmE3L7gLrCt`, commit `f732e7c41ec554ced820232f0bb58847b89fcf42`. The `.eu` domains redirect to `.com`. |
| Git ancestry and file comparison | The deployed commit contains the PR #17 merge. `VillaCanJuanInvestment.tsx`, the timeline/terms components and the admin preview route have no changes from approved preview commit `16e4eb831a64a295933e1391673ebe3e1b004842`. |

The approval quote is retrieved conversation evidence, not a GitHub review.
Repository and Vercel records independently corroborate the subsequent release;
they cannot, by themselves, prove the owner's consent.

## Current visibility

The private page uses the authenticated user's Supabase client, not a service-role
client. It requires an active client/partner/admin profile, an active project,
an explicit project grant and at least one granted active offering belonging to
that project. Queries fail closed. It is dynamically rendered.

| Rights / environment | Project presentation and timeline | Loan terms and investment enquiry | Acquisition enquiry | Separate admin preview |
| --- | --- | --- | --- | --- |
| Signed out | Login required | Hidden | Hidden | Restricted |
| Inactive account | Denied | Hidden | Hidden | Denied |
| No project grant, even with an offering grant | Denied | Hidden | Hidden | Denied for clients |
| Project grant without an active matching offering | Denied | Hidden | Hidden | Denied for clients |
| Project + acquisition (`sale`) | Visible | Hidden, including €6.2m valuation in the loan block | Visible | Denied for clients |
| Project + investment | Visible | Visible | Hidden | Denied for clients |
| Project + both offerings | Visible | Visible | Visible | Denied for clients |
| Active Group admin in isolated Preview | Client route still requires its explicit grants | Per grants on client route | Per grants on client route | Full preview, without copying client grants |
| Any user in Production | Per the above private-page checks | Per investment grant | Per sale grant | Not found |

The timeline has no extra investment requirement. `allowInvestment` gates both
`IbizaLoanTerms` and the financing text in the investment enquiry card.
The Preview route independently requires `VERCEL_ENV=preview`, the exact Staging
Supabase URL, a valid session and an active full Group admin profile. A scoped
Capital role or ordinary client/partner does not satisfy that page's admin check.

Read-only Production database inspection found the Can Juan project and its
investment and sale offerings active. **Six active client/partner accounts have
both project and investment grants; five also have sale grants.** Names and
personal account data were not exported. This establishes eligibility, not that
those people actually opened/read the presentation.

The original preview branch's database URL is confirmed as
`https://senonkpxdtlhyhrubicg.supabase.co` (MZS Staging), separate from Production
`ptrnjzmcehrhbsfxntgw`. Staging contains only synthetic projects and **no actual
`villa-can-juan-ibiza` project record**. The original admin preview renders the
presentation independently; ordinary Staging client access to the real slug is
not provisioned. No Production clients or grants were copied into Staging.

## Executed checks

- **12 actual Staging RLS cases passed** using synthetic users/projects in a
  rollback-only subtransaction: no grants, project only, investment, acquisition,
  both, offering without project, inactive account, partner investment, unrelated
  project offering, rejected self-grant, revocation and anonymous denial.
  Cross-client grant reads were also checked. Existing assignment hashes matched
  before/after; synthetic identities and projects were absent after rollback.
  Reproducible SQL: `supabase/tests/can_juan_access_staging.sql`.
- **32 page/render tests passed**, executing the real TypeScript server page,
  Can Juan presentation, timeline, loan block and preview guard with synthetic
  query responses. Coverage includes both environment modes, full financial-text
  omission for acquisition-only access, denied requests, query failures and
  Preview denial before any database call in Production/mismatched environments.
  These are unit tests, not browser or live Auth tests.
  File: `tests/can-juan-publication.test.mjs`.
- **50 total repository tests passed** with `npm test`; `git diff --check` passed.
- Actual Production project request without a session returned HTTP 307 to
  `/login?role=client`; response did not include the timeline or loan heading.
- Actual Production admin-preview request returned streamed HTTP 200 with a
  Next.js not-found marker and restricted layout; no timeline or loan heading.
  The transport status alone must not be treated as proof of page access.
- Actual immutable Staging preview URL, accessed through the authorized Vercel
  connector, required application login and returned no loan presentation.
- Inspected Production and Staging SELECT policies for profiles, projects,
  project access, offerings, offering access and project content agree on the
  relevant rules. All six inspected Production tables have RLS enabled.

## Verification limits and remaining work

No authenticated browser session was available for the client's full
login-to-page journey or the active administrator's Preview journey. These were
not executed, and no actual Production client was impersonated or logged in.
The combination of active deployment, unchanged server code, actual Production
grants, real Staging RLS tests and rendering tests supports the visibility
conclusion, but does not substitute for that browser acceptance check.

No claim is made about historical page views, emails received, independent
valuation review or confidentiality of pre-existing static image files.
No new app build/deployment was needed because application code is unchanged.

The useful correction is the release documentation on this branch. A new
Production restriction would intentionally withdraw already-approved content
from authorized clients; it should only be implemented/released following a new
explicit owner decision. Production was left untouched.
