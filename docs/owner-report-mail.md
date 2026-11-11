# MZS owner report delivery

User preference (11 November 2026): send authorized e-mails through the MZS platform, from info@mzsgroup.eu, in MZS Group styling. Do not silently substitute Gmail. This preference does not authorize new recipients or sending unsolicited mail. Existing mail flows remain in place.

For research reports addressed to magdy@mzsgroup.eu, the trusted automation queues plain text in production Supabase project ptrnjzmcehrhbsfxntgw via `public.mzs_enqueue_owner_report(p_key,p_subject,p_body)`. Browser users and the mail service cannot enqueue reports. Use safely quoted SQL literals; never interpolate unescaped research text into SQL. This fixed-recipient queue cannot be used to mail anyone else.

For Branding M Nashed use subject exactly `Branding M Nashed` and key `branding-m-nashed:YYYY-MM-DD`, using the scheduled Wednesday date in Europe/Madrid (retries keep that date). Read by key before generating/queuing: if already present, reuse the existing content and status. Do not invent a new key to retry a failed, sending or uncertain item. On conflicting content the function rejects the operation. Read earlier rows of the same prefix to compare prior reports. Include plain HTTPS source links; HTML is escaped by the platform renderer.

Vercel calls `/api/owner-reports/dispatch` every ten minutes using existing CRON_SECRET authorization. It verifies the active, verified recipient account used for the existing hours report, then atomically claims one report. SMTP credentials stay server-side. `accepted` means the SMTP provider accepted the recipient, not confirmed inbox delivery. `sending`/`uncertain` must be investigated, never automatically reset; `pending` has not been claimed. Report content is retained for comparisons and audit.

No Gmail fallback. If queuing or delivery fails, retain the report and report the concrete error in the automation output. Never claim a send while status is pending, sending or uncertain. Future e-mails to other recipients must use their relevant authorized platform workflow rather than expanding this internal queue.
