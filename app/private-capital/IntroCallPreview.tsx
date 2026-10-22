"use client";

import Link from "next/link";
import { type FormEvent, useEffect, useRef, useState } from "react";
import styles from "./intro-call.module.css";

/** Interactive design review only. No API, storage, account creation or email. */
export default function IntroCallPreview() {
  const [ready, setReady] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const confirmation = useRef<HTMLDivElement>(null);
  const nameInput = useRef<HTMLInputElement>(null);
  const returnToForm = useRef(false);

  useEffect(() => { setReady(true); }, []);
  useEffect(() => {
    if (submitted) confirmation.current?.focus();
    else if (returnToForm.current) {
      nameInput.current?.focus();
      returnToForm.current = false;
    }
  }, [submitted]);

  function previewRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = nameInput.current;
    if (name && !name.value.trim()) {
      name.setCustomValidity("Please enter your name.");
      name.reportValidity();
      return;
    }
    // Deliberately keep every entered detail inside the current browser form.
    // Do not submit, persist, log or pass contact details to analytics.
    event.currentTarget.reset();
    setSubmitted(true);
  }

  return (
    <section id="introductory-call" className={styles.section} aria-labelledby="intro-call-heading">
      <div className={styles.layout}>
        <div className={styles.introduction}>
          <p className={styles.eyebrow}>A FIRST CONVERSATION / 04</p>
          <h2 id="intro-call-heading">Let’s start with<br /><em>a conversation.</em></h2>
          <p className={styles.lead}>
            Have a financing need, an investment interest or a potential partnership in mind?
            Let’s get acquainted and explore whether there is a fit.
          </p>
          <div className={styles.callDetails}>
            <span className={styles.clock} aria-hidden="true">
              <svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
            </span>
            <div><strong>A 15-minute introduction</strong><span>Private. Personal. Without obligation.</span></div>
          </div>
          <ol className={styles.steps}>
            <li><span aria-hidden="true">01</span><div><strong>Tell us a little about yourself</strong><p>Just your name and email to get started.</p></div></li>
            <li><span aria-hidden="true">02</span><div><strong>Find a convenient time</strong><p>We’ll arrange your call personally by email.</p></div></li>
            <li><span aria-hidden="true">03</span><div><strong>Explore the possibilities</strong><p>A first conversation, with no commitment.</p></div></li>
          </ol>
          <p className={styles.noAccount}>No account or application required.</p>
        </div>

        <div className={styles.formPanel}>
          <p className={styles.previewNotice} id="intro-preview-note">Design preview · No request will be sent</p>
          {submitted ? (
            <div className={styles.confirmation} ref={confirmation} tabIndex={-1} role="status" aria-labelledby="intro-call-confirmation">
              <span className={styles.confirmationMark} aria-hidden="true">✓</span>
              <p className={styles.eyebrow}>CONFIRMATION PREVIEW</p>
              <h3 id="intro-call-confirmation">Thank you for<br />reaching out.</h3>
              <p>This is how your confirmation will look. In the live version, our team will email you to arrange a convenient time for your introductory call.</p>
              <p className={styles.confirmationNote}>No details have been saved and no call has been booked.</p>
              <button className={styles.resetButton} type="button" onClick={() => { returnToForm.current = true; setSubmitted(false); }}>Back to the form <span aria-hidden="true">↗</span></button>
            </div>
          ) : (
            <>
              <h3>Request an introductory call</h3>
              <p className={styles.formLead}>A simple first step. A personal response.</p>
              <form onSubmit={previewRequest} method="post" aria-label="Introductory call request preview" aria-describedby="intro-preview-note">
                <fieldset disabled={!ready} className={styles.fields}>
                  <legend className={styles.srOnly}>Your contact details</legend>
                  <div className={styles.fieldRow}>
                    <label htmlFor="intro-name">Full name <span className={styles.required} aria-hidden="true">*</span>
                      <input ref={nameInput} id="intro-name" name="name" autoComplete="name" placeholder="Your full name" maxLength={120} required onInput={(event) => event.currentTarget.setCustomValidity("")} />
                    </label>
                    <label htmlFor="intro-email">Email address <span className={styles.required} aria-hidden="true">*</span>
                      <input id="intro-email" name="email" type="email" autoComplete="email" placeholder="you@example.com" maxLength={254} required />
                    </label>
                  </div>
                  <label htmlFor="intro-phone">Phone number <span className={styles.optional}>(optional)</span>
                    <input id="intro-phone" name="phone" type="tel" autoComplete="tel" placeholder="Including country code" maxLength={40} />
                  </label>
                  <label htmlFor="intro-message">What would you like to discuss? <span className={styles.optional}>(optional)</span>
                    <textarea id="intro-message" name="message" rows={3} maxLength={1000} placeholder="A short introduction, or a convenient time to reach you…" />
                  </label>
                  <p className={styles.contactNote}>We’ll use your contact details to arrange this conversation. No account is created.</p>
                  <button className={styles.submitButton} type="submit">Request an introductory call <span aria-hidden="true">↗</span></button>
                  <p className={styles.requiredNote}>* Required fields</p>
                </fieldset>
                <noscript><p className={styles.contactNote}>Please enable JavaScript to try this form preview.</p></noscript>
              </form>
            </>
          )}
        </div>
      </div>
      <div className={styles.memberAccess}>
        <p>Already part of our network?</p>
        <div><Link href="/login">Client & Partner Login <span aria-hidden="true">↗</span></Link><Link href="/request-access">Request Private Access <span aria-hidden="true">↗</span></Link></div>
      </div>
      <p className={styles.disclaimer}>Information on this page is introductory only and does not constitute a public offer of securities, investment advice or a financing commitment.</p>
    </section>
  );
}
