# Polish, Simplified Chinese, Swedish and Romanian preview

Prepared on 26 October 2026. Preview only; no production publication is authorized.

## Scope

Adds pl, zh-CN, sv and ro to public routing, metadata, flag navigation, account language handling, account notification copy and rental emails. Each new catalogue has all 1,132 English source entries. Existing language order is preserved, including Lithuanian immediately before Russian. The four new flags follow the existing languages. Chinese uses natural spacing; the footer switches to two rows earlier to accommodate 15 languages.

Standalone and combined signup/password-recovery Auth templates are provided in docs. They are **not installed in Supabase**. The expanded combined templates preserve the previous template branches and English fallback; they do not add a Turkish branch.

## Translation review

The catalogues are machine-assisted drafts generated locally, with manual corrections for core navigation, account flows, plural forms, financial terms, loan conditions, rental confirmation/cancellation and other critical text. Account/rental mail and Auth template copy were prepared separately. Full native-speaker editorial review is still required before publication, especially property descriptions and legal/financial wording. Technical parity is not a guarantee of linguistic accuracy.

## Validation and remaining acceptance

- Production build, TypeScript and automated catalogue/mail/routing checks must pass on this branch.
- Preview uses the existing staging public Supabase connection, disabled SMTP port and rental-mail capture. No production database changes, real customer registrations, bookings or outgoing mail are part of this work.
- Auth template installation and complete authenticated account acceptance remain separate steps; the preview has no configured service-role key.
- Review all four public previews, Chinese wrapping and the 15-language footer. Mobile visual and native-speaker acceptance remain release gates.
- Publish only after explicit approval of the reviewed preview.
