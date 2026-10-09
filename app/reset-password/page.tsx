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
        const { data, error: authError } = await supabase.auth.getUser();
        if (!mounted) return;
        if (authError || !data.user) {
          setStatus("invalid");
          return;
        }
        // Only activated client/partner accounts can use this page.
        // Inactive invitees must complete the separate invitation process.
        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("role,is_active")
          .eq("id", data.user.id)
          .single();
        if (!mounted) return;
        if (
          profileError || !profile || profile.is_active !== true ||
          (profile.role !== "client" && profile.role !== "partner")
        ) {
          setStatus("invalid");
          return;
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
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError || !userData.user) {
        setStatus("invalid");
        return;
      }
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("role,is_active")
        .eq("id", userData.user.id)
        .single();
      if (
        profileError || !profile || profile.is_active !== true ||
        (profile.role !== "client" && profile.role !== "partner")
      ) {
        setStatus("invalid");
        return;
      }
      setMemberRole(profile.role);

      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) {
        setError("Unable to update your password. Please try again.");
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
      setError("Unable to complete password recovery. Please try again.");
      setStatus("invalid");
    }
  }

  const loginHref = memberRole === "partner" ? "/login?role=partner" : "/login?role=client";
  return (
    <RecoveryLayout role={memberRole}>
      <p className="eyebrow">Account Security</p>
      {status === "checking" && (
        <>
          <h1>Verifying access.</h1>
          <p className="login-intro">Please wait while we verify your recovery session.</p>
        </>
      )}
      {status === "invalid" && (
        <>
          <h1>Link unavailable.</h1>
          <p className="login-intro">
            Your recovery link may have expired, or this account is not eligible for password recovery.
            Please request a new link or contact MZS Group.
          </p>
          {error && <p className="login-error" role="alert">{error}</p>}
          <Link href="/forgot-password" className={recoveryStyles.backLink}>
            Request another recovery link →
          </Link>
        </>
      )}
      {(status === "ready" || status === "saving") && (
        <>
          <h1>Set new password.</h1>
          <p className="login-intro">Choose a secure password for your MZS account.</p>
          <form className="login-form" onSubmit={handleSubmit} aria-busy={status === "saving"}>
            <label>
              New Password
              <input
                type="password"
                autoComplete="new-password"
                minLength={12}
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                disabled={status === "saving"}
              />
            </label>
            <label>
              Confirm Password
              <input
                type="password"
                autoComplete="new-password"
                minLength={12}
                required
                value={confirmation}
                onChange={(event) => setConfirmation(event.target.value)}
                disabled={status === "saving"}
              />
            </label>
            {error && <p className="login-error" role="alert">{error}</p>}
            <button type="submit" disabled={status === "saving"}>
              {status === "saving" ? "Saving..." : "Update Password →"}
            </button>
          </form>
        </>
      )}
      {status === "success" && (
        <>
          <h1>Password updated.</h1>
          <p className="login-intro">
            Your password has been updated. Your project access remains unchanged.
          </p>
          {error && <p className="login-error" role="alert">{error}</p>}
          <Link href={loginHref} className={recoveryStyles.backLink}>
            Continue to {memberRole === "partner" ? "Partner" : "Client"} Login →
          </Link>
        </>
      )}
    </RecoveryLayout>
  );
}
