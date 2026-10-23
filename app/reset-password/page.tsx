"use client";
import {useTranslations, useLocale} from "next-intl";
import {localizedPath} from "../../i18n/public-routing";

import { FormEvent, useEffect, useState } from "react";
import { createClient } from "../../lib/supabase/client";
import RecoveryLayout from "../components/RecoveryLayout";
import recoveryStyles from "../account-recovery.module.css";

type Status = "checking" | "ready" | "saving" | "success" | "partial" | "invalid";
const MIN_PASSWORD_LENGTH = 8;

function allowedProfile(profile: { role: string; is_active: boolean } | null) {
  return !!profile && profile.is_active === true &&
    ["client", "partner", "admin"].includes(profile.role);
}

export default function ResetPasswordPage() {
  const t = useTranslations("AccountUI");
  const locale = useLocale();
  const [status, setStatus] = useState<Status>("checking");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;
    async function verifySession() {
      try {
        const supabase = createClient();
        const { data: auth, error: authError } = await supabase.auth.getUser();
        if (!mounted) return;
        if (authError || !auth.user) throw new Error("No authenticated session");
        const [profileResult, proofResult] = await Promise.all([
          supabase.from("profiles").select("role,is_active").eq("id", auth.user.id).single(),
          supabase.rpc("has_mzs_verified_auth_action", { p_purpose: "recovery" }),
        ]);
        if (!mounted) return;
        if (profileResult.error || proofResult.error || proofResult.data !== true ||
            !allowedProfile(profileResult.data)) {
          throw new Error("Recovery proof missing or expired");
        }
        setStatus("ready");
      } catch {
        if (mounted) setStatus("invalid");
      }
    }
    void verifySession();
    return () => { mounted = false; };
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (status !== "ready") return;
    setError("");
    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(t("passwordMinimum", {count: MIN_PASSWORD_LENGTH}));
      return;
    }
    if (password !== confirmation) {
      setError(t("a012"));
      return;
    }
    setStatus("saving");
    try {
      const supabase = createClient();
      const { data: auth, error: authError } = await supabase.auth.getUser();
      if (authError || !auth.user) { setStatus("invalid"); return; }
      const [profileResult, proofResult] = await Promise.all([
        supabase.from("profiles").select("role,is_active").eq("id", auth.user.id).single(),
        supabase.rpc("has_mzs_verified_auth_action", { p_purpose: "recovery" }),
      ]);
      if (profileResult.error || proofResult.error || proofResult.data !== true ||
          !allowedProfile(profileResult.data)) {
        setStatus("invalid");
        setError(t("a013"));
        return;
      }
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) {
        setError(updateError.code === "same_password"
          ? t("a014")
          : t("a015"));
        setStatus("ready");
        return;
      }
      const { data: consumed, error: consumeError } =
        await supabase.rpc("consume_mzs_password_recovery");
      setPassword("");
      setConfirmation("");
      const { error: signOutError } = await supabase.auth.signOut();
      if (consumeError || consumed !== true) {
        setError(signOutError
          ? t("a016")
          : t("a017"));
        setStatus("partial");
        return;
      }
      if (signOutError) {
        setError(t("a018"));
      }
      setStatus("success");
    } catch {
      setPassword("");
      setConfirmation("");
      setError(t("a019"));
      setStatus("invalid");
    }
  }

  return (
    <RecoveryLayout>
      <p className="eyebrow">{t("a001")}</p>
      {status === "checking" && <>
        <h1>{t("a020")}</h1>
        <p className="login-intro">{t("a021")}</p>
      </>}
      {status === "invalid" && <>
        <h1>{t("a022")}</h1>
        <p className="login-intro">{t("a023")}</p>
        {error && <p className="login-error" role="alert">{error}</p>}
        <a href="/forgot-password" className={recoveryStyles.backLink}>{t("a024")}</a>
      </>}
      {(status === "ready" || status === "saving") && <>
        <h1>{t("a025")}</h1>
        <p className="login-intro">{t("passwordGuidance", {count: MIN_PASSWORD_LENGTH})}</p>
        <form className="login-form" onSubmit={handleSubmit} aria-busy={status === "saving"}>
          <label>{t("a028")}<input type="password" autoComplete="new-password" minLength={MIN_PASSWORD_LENGTH}
              required value={password} onChange={(event) => setPassword(event.target.value)} disabled={status === "saving"} />
          </label>
          <label>{t("a029")}<input type="password" autoComplete="new-password" minLength={MIN_PASSWORD_LENGTH}
              required value={confirmation} onChange={(event) => setConfirmation(event.target.value)} disabled={status === "saving"} />
          </label>
          {error && <p className="login-error" role="alert">{error}</p>}
          <button type="submit" disabled={status === "saving"}>{status === "saving" ? t("a030") : t("a031")}</button>
        </form>
      </>}
      {status === "partial" && <>
        <h1>{t("a032")}</h1>
        <p className="login-intro">{t("a033")}</p>
        {error && <p className="login-error" role="alert">{error}</p>}
        <a href={localizedPath("/login", locale)} className={recoveryStyles.backLink}>{t("a034")}</a>
      </>}
      {status === "success" && <>
        <h1>{t("a032")}</h1>
        <p className="login-intro">{t("a035")}</p>
        {error && <p className="login-error" role="alert">{error}</p>}
        <a href={localizedPath("/login", locale)} className={recoveryStyles.backLink}>{t("a034")}</a>
      </>}
    </RecoveryLayout>
  );
}
