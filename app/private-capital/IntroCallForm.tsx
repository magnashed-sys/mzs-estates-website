"use client";
import PhoneInput from "../components/PhoneInput";
import ArrowUpRightIcon from "../components/ArrowUpRightIcon";
import {useTranslations} from 'next-intl';

import { type FormEvent, useEffect, useRef, useState } from "react";
import styles from "./intro-call.module.css";

/** Public contact request; no account is created. */
export default function IntroCallForm({ preview = false, sectionNumber = "04", source = "private-capital" }: { preview?: boolean; sectionNumber?: string; source?: "private-capital" | "real-estate" | "consultancy" }) {
  const t = useTranslations('Call');
  const consultancy = useTranslations('Consultancy');
  const [ready, setReady] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [reference, setReference] = useState("");
  const [phone, setPhone] = useState("");
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
      name.setCustomValidity(t('please_enter_your_name'));
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
        body: JSON.stringify({ requestKey: requestKey.current, source, name: fields.get("name"), email: fields.get("email"), phone: fields.get("phone"), message: fields.get("message"), website: fields.get("website") }),
        signal: AbortSignal.timeout(25000),
      });
      const result = await response.json();
      if (!response.ok || result.recorded !== true || typeof result.id !== "string") {
        setError(response.status === 429 ? t("rateLimit") : response.status === 400 ? t("checkDetails") : response.status === 413 ? t("shortenMessage") : t("we_could_not_confirm_your_request"));
        return;
      }
      setReference(result.id);
      form.reset();
      setPhone("");
      requestKey.current = null;
      setSubmitted(true);
    } catch {
      setError(t("networkError"));
    } finally { setBusy(false); }
  }

  return (
    <section id="introductory-call" className={styles.section} aria-labelledby="intro-call-heading">
      <div className={styles.layout}>
        <div className={styles.introduction}>
          <p className={styles.eyebrow}>{t('a_first_conversation')} {sectionNumber}</p>
          <h2 id="intro-call-heading">{t('lets_start_with')}<br /><em>{t('a_conversation')}</em></h2>
          <p className={styles.lead}>
            {source === "consultancy" ? consultancy('lead') : source === "real-estate" ? t('looking_to_rent_acquire_or_discuss') : t('have_a_financing_need_an_investment')} {t('lets_get_acquainted_and_explore_whether')} </p>
          <div className={styles.callDetails}>
            <span className={styles.clock} aria-hidden="true">
              <svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
            </span>
            <div><strong>{t('a_15minute_introduction')}</strong><span>{t('private_personal_without_obligation')}</span></div>
          </div>
          <ol className={styles.steps}>
            <li><span aria-hidden="true">01</span><div><strong>{t('tell_us_a_little_about_yourself')}</strong><p>{t('just_your_name_and_email_to')}</p></div></li>
            <li><span aria-hidden="true">02</span><div><strong>{t('find_a_convenient_time')}</strong><p>{t('well_arrange_your_call_personally_by')}</p></div></li>
            <li><span aria-hidden="true">03</span><div><strong>{t('explore_the_possibilities')}</strong><p>{t('a_first_conversation_with_no_commitment')}</p></div></li>
          </ol>
          <p className={styles.noAccount}>{t('no_account_or_application_required')}</p>
        </div>

        <div className={styles.formPanel}>
          {preview && <p className={styles.previewNotice} id="intro-preview-note">{t('test_environment_requests_are_stored_for')}</p>}
          {submitted ? (
            <div className={styles.confirmation} ref={confirmation} tabIndex={-1} role="status" aria-labelledby="intro-call-confirmation">
              <span className={styles.confirmationMark} aria-hidden="true">✓</span>
              <p className={styles.eyebrow}>{t('request_received')}</p>
              <h3 id="intro-call-confirmation">{t('thank_you_for')}<br />{t('reaching_out')}</h3>
              <p>{t("confirmationBody", {brand: source === "consultancy" ? "MZS Group" : source === "real-estate" ? "MZS Estates" : "MZS Capital"})}</p>
              <p className={styles.confirmationNote}>{t('your_request_has_been_received_a')}</p>
              <p className={styles.contactNote}>{t('reference')} {reference}</p>
              <button className={styles.resetButton} type="button" onClick={() => { returnToForm.current = true; setSubmitted(false); }}>{t('back_to_the_form')} <span aria-hidden="true"><ArrowUpRightIcon /></span></button>
            </div>
          ) : (
            <>
              <h3>{t('request_an_introductory_call')}</h3>
              <p className={styles.formLead}>{t('a_simple_first_step_a_personal')}</p>
              <form onSubmit={submitRequest} onInput={() => { requestKey.current = null; }} method="post" aria-label={t('introductory_call_request')} aria-describedby={preview ? "intro-preview-note" : undefined}>
                <fieldset disabled={!ready || busy} className={styles.fields}>
                  <legend className={styles.srOnly}>{t('your_contact_details')}</legend>
                  <div className={styles.srOnly} aria-hidden="true"><label>{t('leave_this_field_empty')}<input name="website" tabIndex={-1} autoComplete="off" /></label></div>
                  <div className={styles.fieldRow}>
                    <label htmlFor="intro-name">{t('full_name')} <span className={styles.required} aria-hidden="true">*</span>
                      <input ref={nameInput} id="intro-name" name="name" autoComplete="name" placeholder={t('your_full_name')} maxLength={120} required onInput={(event) => event.currentTarget.setCustomValidity("")} />
                    </label>
                    <label htmlFor="intro-email">{t('email_address')} <span className={styles.required} aria-hidden="true">*</span>
                      <input id="intro-email" name="email" type="email" autoComplete="email" placeholder={t('youexamplecom')} maxLength={254} required />
                    </label>
                  </div>
                  <PhoneInput name="phone" value={phone} onChange={value => {setPhone(value);requestKey.current=null;}} label={<>{t('phone_number')} <span className={styles.optional}>{t('optional')}</span></>} disabled={!ready || busy} />
                  <label htmlFor="intro-message">{t('what_would_you_like_to_discuss')} <span className={styles.optional}>{t('optional')}</span>
                    <textarea id="intro-message" name="message" rows={3} maxLength={1000} placeholder={t('a_short_introduction_or_a_convenient')} />
                  </label>
                  <p className={styles.contactNote}>{t('well_use_your_contact_details_to')}</p>
                  <details className={styles.contactNote}><summary>{t('how_we_use_your_details')}</summary><p>{t('mzs_group_stores_the_details_you')} <a href="mailto:info@mzsgroup.eu">{t('infomzsgroupeu')}</a>.</p></details>
                  {error && <p role="alert" className={styles.error}>{error}</p>}
                  <button className={styles.submitButton} type="submit" disabled={busy}>{busy ? t('sending_your_request') : t('request_an_introductory_call')} <span aria-hidden="true"><ArrowUpRightIcon /></span></button>
                  <p className={styles.requiredNote}>{t('required_fields')}</p>
                </fieldset>
                <noscript><p className={styles.contactNote}>{t('please_enable_javascript_to_use_this')}</p></noscript>
              </form>
            </>
          )}
        </div>
      </div>
      <div className={styles.memberAccess}>
        <p>{t('already_part_of_our_network')}</p>
        <div><a href="/login">{t('client_partner_login')} <span aria-hidden="true"><ArrowUpRightIcon /></span></a><a href="/request-access">{t('request_private_access')} <span aria-hidden="true"><ArrowUpRightIcon /></span></a></div>
      </div>
      <p className={styles.disclaimer}>{t('information_on_this_page_is_introductory')}</p>
    </section>
  );
}
