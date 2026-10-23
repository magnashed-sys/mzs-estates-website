"use client";
import {useTranslations, useLocale} from "next-intl";
import {localizedPath} from "../../i18n/public-routing";

import { FormEvent, useEffect, useState } from "react";
import { createClient } from "../../lib/supabase/client";
import RecoveryLayout from "../components/RecoveryLayout";
import recoveryStyles from "../account-recovery.module.css";

type Status = "checking" | "ready" | "saving" | "success" | "invalid";
type Role = "client" | "partner";

export default function AcceptInvitationPage() {
  const t = useTranslations("AccountUI");
  const locale = useLocale();
  const [status, setStatus] = useState<Status>("checking");
  const [role, setRole] = useState<Role>("client");
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    async function verify() {
      try {
        const supabase = createClient();
        const { data: auth, error: authError } = await supabase.auth.getUser();
        if (!active) return;
        if (authError || !auth.user) throw new Error("No verified invitation session");

        const [profileResult, proofResult] = await Promise.all([
          supabase.from("profiles")
            .select("role,is_active,full_name")
            .eq("id", auth.user.id)
            .single(),
          supabase.rpc("has_mzs_verified_auth_action", { p_purpose: "invite" }),
        ]);
        if (!active) return;

        const profile = profileResult.data;
        if (profileResult.error || proofResult.error || proofResult.data !== true ||
            !profile || profile.is_active !== false ||
            (profile.role !== "client" && profile.role !== "partner")) {
          throw new Error("Invitation proof missing or expired");
        }
        setRole(profile.role);
        setFullName(profile.full_name ?? "");
        setStatus("ready");
      } catch {
        if (active) setStatus("invalid");
      }
    }
    void verify();
    return () => { active = false; };
  }, []);

  async function activate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (status !== "ready") return;
    setError("");
    const name = fullName.trim().replace(/\s+/g, " ");
    if (name.length < 3 || name.length > 120 || name.split(" ").length < 2) {
      setError(t("a038"));
      return;
    }
    if (password.length < 8) {
      setError(t("a039"));
      return;
    }
    if (password !== confirmation) {
      setError(t("a012"));
      return;
    }

    setStatus("saving");
    const supabase = createClient();
    try {
      const { data: proof, error: proofError } = await supabase.rpc(
        "has_mzs_verified_auth_action", { p_purpose: "invite" }
      );
      if (proofError || proof !== true) {
        throw new Error(t("a040"));
      }

      const { data: nameSaved, error: nameError } = await supabase.rpc(
        "complete_invitation_name", { p_full_name: name }
      );
      if (nameError || nameSaved !== true) {
        setError(t("a041"));
        setStatus("ready");
        return;
      }

      const { error: passwordError } = await supabase.auth.updateUser({ password });
      if (passwordError) {
        setError(passwordError.code === "same_password"
          ? t("a042")
          : t("a043"));
        setStatus("ready");
        return;
      }

      const { data: activated, error: activationError } = await supabase.rpc(
        "finalize_invited_registration"
      );
      if (activationError || activated !== true) {
        setPassword("");
        setConfirmation("");
        setError(t("a044"));
        setStatus("invalid");
        return;
      }

      setPassword("");
      setConfirmation("");
      const { error: signOutError } = await supabase.auth.signOut();
      if (signOutError) {
        setError(t("a045"));
      }
      setStatus("success");
    } catch (cause) {
      setPassword("");
      setConfirmation("");
      setError(cause instanceof Error && cause.message === t("a040") ? t("a040") : t("a046"));
      setStatus("invalid");
    }
  }

  const loginHref = localizedPath("/login", locale) + (role === "partner" ? "?role=partner" : "?role=client");
  const firstName = fullName.trim().split(/\s+/)[0] || t("a047");

  return (
    <RecoveryLayout role={role}>
      <p className="eyebrow">{t("a048")}</p>
      {status === "checking" && (
        <><h1>{t("a049")}</h1>
          <p className="login-intro">{t("a050")}</p></>
      )}
      {status === "invalid" && (
        <><h1>{t("a051")}</h1>
          <p className="login-intro">{t("a052")}</p>
          {error && <p className="login-error" role="alert">{error}</p>}
          <a href={localizedPath("/", locale)} className={recoveryStyles.backLink}>{t("a053")}</a></>
      )}
      {(status === "ready" || status === "saving") && (
        <><h1>{t("a054")}</h1>
          <p className="login-intro">{t("a055")}</p>
          <form className="login-form" onSubmit={activate} aria-busy={status === "saving"}>
            <label>{t("a056")}<input type="text" autoComplete="name" maxLength={120} required
                value={fullName} onChange={(e) => setFullName(e.target.value)}
                disabled={status === "saving"}/>
            </label>
            <label>{t("a028")}<input type="password" autoComplete="new-password" minLength={8} required
                value={password} onChange={(e) => setPassword(e.target.value)}
                disabled={status === "saving"}/>
            </label>
            <label>{t("a029")}<input type="password" autoComplete="new-password" minLength={8} required
                value={confirmation} onChange={(e) => setConfirmation(e.target.value)}
                disabled={status === "saving"}/>
            </label>
            {error && <p className="login-error" role="alert">{error}</p>}
            <button type="submit" disabled={status === "saving"}>
              {status === "saving" ? t("a057") : t("a058")}
            </button>
          </form></>
      )}
      {status === "success" && (
        <><h1>{t("welcomeName", {name: firstName})}</h1>
          <p className="login-intro">{t("a060")}</p>
          {error && <p className="login-error" role="alert">{error}</p>}
          <a href={loginHref} className={recoveryStyles.backLink}>
            {t("loginRole", {role: role === "partner" ? t("a062") : t("a063")})}
          </a></>
      )}
    </RecoveryLayout>
  );
}
