# Private Capital introductory calls

The public form at `/private-capital#introductory-call` accepts name and email, with optional telephone and message. It creates neither an account nor an appointment. The team arranges a time personally.

`POST /api/intro-calls` checks deployment/database pairing, origin, bounded JSON input, a honeypot and hashed IP/email rate limits. A UUID request key prevents duplicate submissions. A service-only database function atomically records the enquiry and queues notifications for active full administrators.

`/admin/intro-calls` requires an active full administrator; database row policies enforce the same access. Administrators can set New, Contacted or Closed. Contact details never appear in notification emails, which link to the protected overview. Existing outbox retry delivery applies. Preview suppresses mail even if SMTP is configured.

Apply `20261023061600_private_capital_intro_calls.sql` before deploying. Preview requires the staging URL and service role; production requires its production counterparts. Existing SMTP settings are reused. There is no automatic confirmation email to an unverified visitor, only an onscreen saved-request confirmation.
