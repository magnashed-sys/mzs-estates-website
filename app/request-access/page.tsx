"use client";
import {trackLead} from "../../lib/analytics/google";
import CountrySelect from "../components/CountrySelect";
import RussianAccessNotice from "../components/RussianAccessNotice";
import {useTranslations, useLocale} from "next-intl";
import {localizedPath} from "../../i18n/public-routing";

import {registrationErrorKey} from "../../i18n/registration-errors";
import styles from "../public-access-refresh.module.css";

import { FormEvent, useState } from "react";
import PublicHeader from "../components/PublicHeader";
import HomeContactFooter from "../components/HomeContactFooter";


const pageStyle: React.CSSProperties = {
  position: "relative",
  isolation: "isolate",
  minHeight: "100svh",
  backgroundColor: "#0b0b0a",
  backgroundImage:
    "linear-gradient(90deg, rgba(7,9,10,.88) 0%, rgba(7,9,10,.73) 46%, rgba(7,9,10,.40) 100%), url('/images/request-access-bg.webp')",
  backgroundPosition: "center center",
  backgroundSize: "cover",
  backgroundRepeat: "no-repeat",
  color: "#f1ede6",
};

const contentStyle: React.CSSProperties = {
  position: "relative",
  zIndex: 1,
};

export default function RequestAccessPage() {
  const t = useTranslations("AccountUI");
  const locale = useLocale();
  const interests = [
    { value: "investment", label: t("a065") },
    { value: "financing", label: t("a066") },
    { value: "sale", label: t("a067") },
    { value: "rental", label: t("a068") },
  ];
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [country, setCountry] = useState("");
  const [message, setMessage] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  function toggleInterest(value: string) {
    setSelectedInterests((current) =>
      current.includes(value)
        ? current.filter((item) => item !== value)
        : [...current, value]
    );
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading || submitted) return;
    setError("");
    if (password.length < 8) {
      setError(t("a069"));
      return;
    }
    if (password !== passwordConfirmation) {
      setError(t("a070"));
      return;
    }
    setLoading(true);
    try {
      const response = await fetch("/api/account/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({
          full_name: fullName, email, company, country,
          interests: selectedInterests, message,
          password, confirm_password: passwordConfirmation, preferred_language: locale,
        }),
      });
      const result: { ok?: boolean; error?: string } = await response.json();
      if (!response.ok || !result.ok) {
        setError(t(registrationErrorKey(result.error)));
        return;
      }
      trackLead("account_request");
      setSubmitted(true);
      setPassword("");
      setPasswordConfirmation("");
    } catch {
      setError(t("a072"));
    } finally {
      setLoading(false);
    }
  }

  if (submitted) {
    return (
      <main className={`request-page ${styles.page} ${styles.requestPage}`} style={pageStyle}>
        <PublicHeader />
        <section className="request-success" style={contentStyle}>
          <p className="eyebrow">{t("a073")}</p>
          <h1>{t("a074")}</h1>
          <p>{t("a075")}</p>
          <p className="request-success-note">{t("a076")}</p>
          <a href={localizedPath("/", locale)} className="request-return">{t("a053")}</a>
        </section>
        <div className={styles.publicFooter}><HomeContactFooter /></div>
      </main>
    );
  }

  return (
    <main className={`request-page ${styles.page} ${styles.requestPage}`} style={pageStyle}>
      <PublicHeader />
      <section className="request-container" style={contentStyle}>
        <p className="eyebrow">{t("a077")}</p>
        <h1>{t("a078")}</h1>
        <p className="request-intro">
          {t("a079")}</p>
        <RussianAccessNotice />
        <form className="request-form" onSubmit={handleSubmit} aria-busy={loading}>
          <div className="request-grid">
            <label>
              {t("a080")}<input type="text" autoComplete="name" value={fullName}
                onChange={(event) => setFullName(event.target.value)} required disabled={loading} />
            </label>
            <label>
              {t("a005")}<input type="email" autoComplete="email" value={email}
                onChange={(event) => setEmail(event.target.value)} required disabled={loading} />
            </label>
            <label>
              {t("a081")}<input type="text" autoComplete="organization" value={company}
                onChange={(event) => setCompany(event.target.value)} disabled={loading} />
            </label>
            <label>
              {t("a082")}<CountrySelect value={country} onChange={setCountry} disabled={loading} />
            </label>
            <label>
              {t("a083")}<input type="password" autoComplete="new-password" minLength={8} maxLength={128}
                value={password} onChange={event => setPassword(event.target.value)}
                required disabled={loading} />
            </label>
            <label>
              {t("a084")}<input type="password" autoComplete="new-password" minLength={8} maxLength={128}
                value={passwordConfirmation} onChange={event => setPasswordConfirmation(event.target.value)}
                required disabled={loading} />
            </label>
          </div>
          <fieldset className="request-interests" disabled={loading}>
            <legend>{t("a085")}</legend>
            <div className="interest-options">
              {interests.map((interest) => (
                <label key={interest.value}
                  className={selectedInterests.includes(interest.value)
                    ? "interest-option selected" : "interest-option"}>
                  <input type="checkbox"
                    checked={selectedInterests.includes(interest.value)}
                    onChange={() => toggleInterest(interest.value)} />
                  {interest.label}
                </label>
              ))}
            </div>
          </fieldset>
          <label className="request-message">
            {t("a086")}<textarea rows={4} value={message}
              onChange={(event) => setMessage(event.target.value)} disabled={loading} />
          </label>
          <p className="request-success-note">{t("a087")}</p>
          {error && <p className="login-error" role="alert">{error}</p>}
          <button type="submit" disabled={loading}>
            {loading ? t("a088") : t("a089")}
          </button>
        </form>
      </section>
      <div className={styles.publicFooter}><HomeContactFooter /></div>
    </main>
  );
}

