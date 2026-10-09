"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "../../lib/supabase/client";
import RecoveryLayout from "../components/RecoveryLayout";
import recoveryStyles from "../account-recovery.module.css";

type Status = "checking" | "ready" | "saving" | "success" | "invalid";
type Role = "client" | "partner";

export default function AcceptInvitationPage() {
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
      setError("Please enter your full first and last name.");
      return;
    }
    if (password.length < 12) {
      setError("Please use at least 12 characters.");
      return;
    }
    if (password !== confirmation) {
      setError("Passwords do not match.");
      return;
    }

    setStatus("saving");
    const supabase = createClient();
    try {
      const { data: proof, error: proofError } = await supabase.rpc(
        "has_mzs_verified_auth_action", { p_purpose: "invite" }
      );
      if (proofError || proof !== true) {
        throw new Error("Invitation expired. Please contact MZS Group for assistance.");
      }

      const { data: nameSaved, error: nameError } = await supabase.rpc(
        "complete_invitation_name", { p_full_name: name }
      );
      if (nameError || nameSaved !== true) {
        setError("Unable to save your details. Please try again.");
        setStatus("ready");
        return;
      }

      const { error: passwordError } = await supabase.auth.updateUser({ password });
      if (passwordError) {
        setError(passwordError.code === "same_password"
          ? "Your new password must be different from the previous password."
          : "Unable to set your password. Please try again.");
        setStatus("ready");
        return;
      }

      const { data: activated, error: activationError } = await supabase.rpc(
        "finalize_invited_registration"
      );
      if (activationError || activated !== true) {
        setPassword("");
        setConfirmation("");
        setError("Your password was saved, but activation could not be completed. Please contact MZS Group. Do not create another account.");
        setStatus("invalid");
        return;
      }

      setPassword("");
      setConfirmation("");
      const { error: signOutError } = await supabase.auth.signOut();
      if (signOutError) {
        setError("Your account is active, but sign out could not be completed. Please sign out before logging in again.");
      }
      setStatus("success");
    } catch (cause) {
      setPassword("");
      setConfirmation("");
      setError(cause instanceof Error ? cause.message : "Unable to complete registration. Please contact MZS Group.");
      setStatus("invalid");
    }
  }

  const loginHref = role === "partner" ? "/login?role=partner" : "/login?role=client";
  const firstName = fullName.trim().split(/\s+/)[0] || "Member";

  return (
    <RecoveryLayout role={role}>
      <p className="eyebrow">By invitation only</p>
      {status === "checking" && (
        <><h1>Verifying invitation.</h1>
          <p className="login-intro">Please wait while we verify your personal invitation.</p></>
      )}
      {status === "invalid" && (
        <><h1>Registration unavailable.</h1>
          <p className="login-intro">Your invitation may have expired or is no longer available. Please contact MZS Group.</p>
          {error && <p className="login-error" role="alert">{error}</p>}
          <Link href="/" className={recoveryStyles.backLink}>Return to MZS Group →</Link></>
      )}
      {(status === "ready" || status === "saving") && (
        <><h1>Welcome to MZS.</h1>
          <p className="login-intro">Complete your details and create a secure password to activate your private account.</p>
          <form className="login-form" onSubmit={activate} aria-busy={status === "saving"}>
            <label>Full Name
              <input type="text" autoComplete="name" maxLength={120} required
                value={fullName} onChange={(e) => setFullName(e.target.value)}
                disabled={status === "saving"}/>
            </label>
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
              {status === "saving" ? "Activating..." : "Activate My Account →"}
            </button>
          </form></>
      )}
      {status === "success" && (
        <><h1>Welcome, {firstName}.</h1>
          <p className="login-intro">Your MZS account has been activated. Your approved project selection has already been attached to your account.</p>
          {error && <p className="login-error" role="alert">{error}</p>}
          <Link href={loginHref} className={recoveryStyles.backLink}>
            Continue to {role === "partner" ? "Partner" : "Client"} Login →
          </Link></>
      )}
    </RecoveryLayout>
  );
}
