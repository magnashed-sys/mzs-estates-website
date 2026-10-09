"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "../../lib/supabase/client";
import RecoveryLayout from "../components/RecoveryLayout";
import recoveryStyles from "../account-recovery.module.css";

type Status = "checking" | "ready" | "saving" | "success" | "invalid";
type MemberRole = "client" | "partner";

export default function ResetPasswordPage() {
  const [status, setStatus] = useState<Status>("checking");
  const [memberRole, setMemberRole] = useState<MemberRole>("client");
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
        const profile = profileResult.data;
        if (profileResult.error || proofResult.error || proofResult.data !== true ||
            !profile || profile.is_active !== true ||
            (profile.role !== "client" && profile.role !== "partner")) {
          throw new Error("Recovery proof missing or expired");
        }
        setMemberRole(profile.role);
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
    if (password.length < 12) {
      setError("Please use at least 12 characters.");
      return;
    }
    if (password !== confirmation) {
      setError("Passwords do not match.");
      return;
    }

    setStatus("saving");
    try {
      const supabase = createClient();
      const { data: auth, error: authError } = await supabase.auth.getUser();
      if (authError || !auth.user) {
        setStatus("invalid");
        return;
      }

      const [profileResult, proofResult] = await Promise.all([
        supabase.from("profiles").select("role,is_active").eq("id", auth.user.id).single(),
        supabase.rpc("has_mzs_verified_auth_action", { p_purpose: "recovery" }),
      ]);
      const profile = profileResult.data;
      if (profileResult.error || proofResult.error || proofResult.data !== true ||
          !profile || profile.is_active !== true ||
          (profile.role !== "client" && profile.role !== "partner")) {
        setStatus("invalid");
        setError("Recovery verification expired. Please request a new link.");
        return;
      }
      setMemberRole(profile.role);

      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) {
        setError(updateError.code === "same_password"
          ? "Your new password must be different from your current password. Please choose another."
          : "Unable to update your password. Please try again.");
        setStatus("ready");
        return;
      }

      setPassword("");
      setConfirmation("");
      const { error: signOutError } = await supabase.auth.signOut();
      if (signOutError) {
        setError("Your password was updated, but automatic sign out failed. Please sign out before logging in again.");
      }
      setStatus("success");
    } catch {
      setPassword("");
      setConfirmation("");
      setError("Unable to complete password recovery. Please request a new link.");
      setStatus("invalid");
    }
  }

  const loginHref = memberRole === "partner" ? "/login?role=partner" : "/login?role=client";
  return (
    <RecoveryLayout role={memberRole}>
      <p className="eyebrow">Account Security</p>
      {status === "checking" && (
        <><h1>Verifying access.</h1>
          <p className="login-intro">Please wait while we verify your recovery session.</p></>
      )}
      {status === "invalid" && (
        <><h1>Link unavailable.</h1>
          <p className="login-intro">Your recovery link may have expired or is no longer available. Please request a new link.</p>
          {error && <p className="login-error" role="alert">{error}</p>}
          <Link href="/forgot-password" className={recoveryStyles.backLink}>
            Request another recovery link →
          </Link></>
      )}
      {(status === "ready" || status === "saving") && (
        <><h1>Set new password.</h1>
          <p className="login-intro">Choose a secure password for your MZS account.</p>
          <form className="login-form" onSubmit={handleSubmit} aria-busy={status === "saving"}>
            <label>New Password
              <input type="password" autoComplete="new-password" minLength={12} required
                value={password} onChange={(e) => setPassword(e.target.value)}
                disabled={status === "saving"}/>
            </label>
            <label>Confirm Password
              <input type="password" autoComplete="new-password" minLength={12} required
                value={confirmation} onChange={(e) => setConfirmation(e.target.value)}
                disabled={status === "saving"}/>
            </label>
            {error && <p className="login-error" role="alert">{error}</p>}
            <button type="submit" disabled={status === "saving"}>
              {status === "saving" ? "Saving..." : "Update Password →"}
            </button>
          </form></>
      )}
      {status === "success" && (
        <><h1>Password updated.</h1>
          <p className="login-intro">Your password has been updated. Your project access remains unchanged.</p>
          {error && <p className="login-error" role="alert">{error}</p>}
          <Link href={loginHref} className={recoveryStyles.backLink}>
            Continue to {memberRole === "partner" ? "Partner" : "Client"} Login →
          </Link></>
      )}
    </RecoveryLayout>
  );
}
