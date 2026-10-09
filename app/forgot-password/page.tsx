"use client";

import { FormEvent, Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { createClient } from "../../lib/supabase/client";
import RecoveryLayout from "../components/RecoveryLayout";
import recoveryStyles from "../account-recovery.module.css";

const genericConfirmation =
  "If an eligible MZS account exists for this email address, you will receive password recovery instructions shortly. Please check your inbox and spam folder.";

function ForgotPasswordForm() {
  const searchParams = useSearchParams();
  const isPartner = searchParams.get("role") === "partner";
  const role = isPartner ? "partner" : "client";
  const loginHref = isPartner ? "/login?role=partner" : "/login?role=client";
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
      await createClient().auth.resetPasswordForEmail(email.trim(), {
        redirectTo: "https://www.mzsgroup.eu/reset-password",
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
    <RecoveryLayout role={role}>
      <p className="eyebrow">Account Security</p>
      {submitted ? (
        <>
          <h1>Check your inbox.</h1>
          <p className={recoveryStyles.successMessage} role="status">
            {genericConfirmation}
          </p>
        </>
      ) : (
        <>
          <h1>Reset your password.</h1>
          <p className="login-intro">
            Enter the email address associated with your private MZS account.
          </p>
          <form className="login-form" onSubmit={handleRequest} aria-busy={sending}>
            <label>
              Email
              <input
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
              {sending ? "Sending..." : "Send recovery link →"}
            </button>
          </form>
          <p className={recoveryStyles.recoveryNote}>
            New relationships must first request a personal invitation.
          </p>
        </>
      )}
      <Link href={loginHref} className={recoveryStyles.backLink}>
        ← Return to {isPartner ? "Partner" : "Client"} Login
      </Link>
    </RecoveryLayout>
  );
}

export default function ForgotPasswordPage() {
  return (
    <Suspense fallback={
      <RecoveryLayout role="client">
        <p className="login-intro">Loading account recovery...</p>
      </RecoveryLayout>
    }>
      <ForgotPasswordForm />
    </Suspense>
  );
}
