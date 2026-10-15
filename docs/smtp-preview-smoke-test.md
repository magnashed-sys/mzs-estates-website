# SMTP connection check — MZS Group

The legacy Supabase Auth invitation mailbox uses these non-secret settings:
- SMTP host: mail.mzsgroup.eu
- SMTP port: 465 (implicit TLS)
- SMTP mailbox: invitations@mzsgroup.eu

The mailer checks optional MZS_SMTP_* overrides first, then existing SMTP_* keys.

The following environment variables are required in both Preview and Production:
- MZS_SMTP_HOST
- MZS_SMTP_PORT
- MZS_SMTP_USER
- MZS_SMTP_FROM
- MZS_SMTP_PASSWORD (secret; never paste in chat or GitHub)

Supabase Auth SMTP credentials do not automatically propagate to Vercel.

## Testing on the Preview branch

1. After adding variables to Vercel, create a **new Preview deployment**. An
   existing READY deployment does not necessarily include recently edited vars.
2. Open the freshly built Preview deployment in your browser.
3. Sign in as the existing MZS administrator if required.
4. Navigate to /admin?tab=relationships and click **Verify SMTP connection**.
5. Report only the status (verified / settings missing / connection failed).
   Never share passwords or the SMTP server response body.
6. This only tests an authenticated TLS connection; it **does not** send an
   email. Confirm real mailbox delivery in a separate controlled test.

Database migration and registration remain blocked pending isolated tests.
Never test new account registration against production before the reviewed SQL
migration and the new code are released together.
