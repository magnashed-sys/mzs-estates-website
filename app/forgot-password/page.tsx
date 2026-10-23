"use client";
import {useTranslations, useLocale} from "next-intl";
import {localizedPath} from "../../i18n/public-routing";

import { FormEvent, useState } from "react";
import { createClient } from "../../lib/supabase/client";
import RecoveryLayout from "../components/RecoveryLayout";
import recoveryStyles from "../account-recovery.module.css";

export default function ForgotPasswordPage() {
  const t = useTranslations("AccountUI");
  const locale = useLocale();
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  async function handleRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (sending || submitted) return;

    setSending(true);

    try {
      // A generic response avoids revealing which addresses are registered.
      // This never activates accounts or changes project permissions.
      // MZS Staging uses a custom one-time verification callback so that
      // password recovery stays inside the isolated Preview environment.
      // Production retains its established recovery redirect.
      const previewHost = window.location.hostname;
      const isolatedPreview = previewHost.startsWith("mzs-group-") &&
        previewHost.endsWith("-mzs3.vercel.app");
      await createClient().auth.resetPasswordForEmail(email.trim(), {
        redirectTo: window.location.origin +
          (isolatedPreview ? "/auth/confirm" : "/reset-password"),
      });
    } catch {
      // Do not disclose whether the email is registered.
      // Operational delivery issues can be checked in Supabase Auth logs.
    } finally {
      setSending(false);
      setSubmitted(true);
    }
  }

  return (
    <RecoveryLayout role="client">
      <p className="eyebrow">{t("a001")}</p>

      {submitted ? (
        <>
          <h1>{t("a002")}</h1>
          <p className={recoveryStyles.successMessage} role="status">
            {t("a000")}
          </p>
        </>
      ) : (
        <>
          <h1>{t("a003")}</h1>
          <p className="login-intro">
            {t("a004")}</p>

          <form
            className="login-form"
            onSubmit={handleRequest}
            aria-busy={sending}
          >
            <label>
              {t("a005")}<input
                type="email"
                name="email"
                autoComplete="email"
                inputMode="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
                disabled={sending}
              />
            </label>

            <button type="submit" disabled={sending}>
              {sending ? t("a006") : t("a007")}
            </button>
          </form>

          <p className={recoveryStyles.recoveryNote}>
            {t("a008")}</p>
        </>
      )}

      <a href={localizedPath("/login", locale)} className={recoveryStyles.backLink}>
        {t("a009")}</a>
    </RecoveryLayout>
  );
}
