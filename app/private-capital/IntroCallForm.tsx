"use client";

import Link from "next/link";
import { type FormEvent, useEffect, useRef, useState } from "react";
import styles from "./intro-call.module.css";

/** Public contact request; no account is created. */
export default function IntroCallForm({ preview = false, sectionNumber = "04" }: { preview?: boolean; sectionNumber?: string }) {
  const [ready, setReady] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [reference, setReference] = useState("");
  const requestKey = useRef<string | null>(null);
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

  async function submitRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const form = event.currentTarget;
    const name = nameInput.current;
    if (name && !name.value.trim()) {
      name.setCustomValidity("Please enter your name.");
      name.reportValidity();
      return;
    }
    const fields = new FormData(form);
    requestKey.current ||= crypto.randomUUID();
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/intro-calls", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestKey: requestKey.current, name: fields.get("name"), email: fields.get("email"), phone: fields.get("phone"), message: fields.get("message"), website: fields.get("website") }),
        signal: AbortSignal.timeout(25000),
      });
      const result = await response.json();
      if (!response.ok || result.recorded !== true || typeof result.id !== "string") {
        setError(typeof result.error === "string" ? result.error : "We could not confirm your request. Please try again.");
        return;
      }
      setReference(result.id);
      form.reset();
      requestKey.current = null;
      setSubmitted(true);
    } catch {
      setError("We could not confirm your request. Please try again, or email info@mzsgroup.eu. Your details remain in the form.");
    } finally { setBusy(false); }
  }

  return (
    <section id="introductory-call" className={styles.section} aria-labelledby="intro-call-heading">
      <div className={styles.layout}>
        <div className={styles.introduction}>
          <p className={styles.eyebrow}>A FIRST CONVERSATION / {sectionNumber}</p>
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
          {preview && <p className={styles.previewNotice} id="intro-preview-note">Test environment · Requests are stored for testing; no emails are sent</p>}
          {submitted ? (
            <div className={styles.confirmation} ref={confirmation} tabIndex={-1} role="status" aria-labelledby="intro-call-confirmation">
              <span className={styles.confirmationMark} aria-hidden="true">✓</span>
              <p className={styles.eyebrow}>REQUEST RECEIVED</p>
              <h3 id="intro-call-confirmation">Thank you for<br />reaching out.</h3>
              <p>Thank you for your interest in MZS Capital. Our team will contact you by email to arrange a convenient time for your introductory call.</p>
              <p className={styles.confirmationNote}>Your request has been received. A call time will be agreed with you personally.</p>
              <p className={styles.contactNote}>Reference: {reference}</p>
              <button className={styles.resetButton} type="button" onClick={() => { returnToForm.current = true; setSubmitted(false); }}>Back to the form <span aria-hidden="true">↗</span></button>
            </div>
          ) : (
            <>
              <h3>Request an introductory call</h3>
              <p className={styles.formLead}>A simple first step. A personal response.</p>
              <form onSubmit={submitRequest} onInput={() => { requestKey.current = null; }} method="post" aria-label="Introductory call request" aria-describedby={preview ? "intro-preview-note" : undefined}>
                <fieldset disabled={!ready || busy} className={styles.fields}>
                  <legend className={styles.srOnly}>Your contact details</legend>
                  <div className={styles.srOnly} aria-hidden="true"><label>Leave this field empty<input name="website" tabIndex={-1} autoComplete="off" /></label></div>
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
                  <details className={styles.contactNote}><summary>How we use your details</summary><p>MZS Group stores the details you provide to respond to your enquiry and arrange your call. Access is limited to authorised administrators. This does not subscribe you to marketing. To ask about your information or request its deletion, contact <a href="mailto:info@mzsgroup.eu">info@mzsgroup.eu</a>.</p></details>
                  {error && <p role="alert" className={styles.error}>{error}</p>}
                  <button className={styles.submitButton} type="submit" disabled={busy}>{busy ? "Sending your request…" : "Request an introductory call"} <span aria-hidden="true">↗</span></button>
                  <p className={styles.requiredNote}>* Required fields</p>
                </fieldset>
                <noscript><p className={styles.contactNote}>Please enable JavaScript to use this form, or email info@mzsgroup.eu to request a call.</p></noscript>
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
