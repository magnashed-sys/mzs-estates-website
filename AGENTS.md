# MZS platform working preferences

- Authorized outgoing e-mails must use the MZS platform mail provision, with `info@mzsgroup.eu` as sender and MZS Group styling. Do not default or fall back to a personal Gmail account. User instruction recorded 11 November 2026.
- For internal owner research reports, follow `docs/owner-report-mail.md`. Preserve recipient authorization, idempotency and delivery records. Keep SMTP credentials on the server. New workflows must not bypass the existing authorization controls.
- Distinguish queued, SMTP-accepted and uncertain delivery. Never claim inbox receipt without evidence.
