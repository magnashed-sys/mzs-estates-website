# Private Capital introductory call — design preview

The public `/private-capital` page offers a first conversation without an account in isolated Vercel Preview. Its hero CTA links to `#introductory-call`. The final section contains name/email (required), telephone/message (optional), a proposed 15-minute introduction, and secondary existing login/access links. Existing introductory financial wording remains intact.

This is a frontend prototype, as requested. The form explicitly identifies itself as a design preview, validates fields, displays a confirmation preview, and supports returning to a cleared form. Nothing is submitted, saved, logged, emailed or booked. The fieldset stays disabled until hydration, so a no-JavaScript visit cannot submit contact details. No new tracking or campaign data collection is enabled.

The server guard renders the prototype only when `VERCEL_ENV=preview` and the Supabase URL matches the isolated Staging project. Production renders the existing invitation and hero CTA. Preview metadata is noindex/nofollow. No schema, private Capital request flow or client permission changes.

Before a separately approved live release: confirm call duration and follow-up ownership; implement the public intake endpoint, server validation and abuse protection; agree storage/retention and link the appropriate privacy notice; route requests to the intended administrator and test email delivery with designated test recipients. Campaign conversion measurement should count a successfully saved request, not a button click.

Verification: build/type checks, the Preview/Production environment matrix, and browser checks for anchor navigation, required fields, invalid email, confirmation/reset, mobile layout and no form submission network traffic.
