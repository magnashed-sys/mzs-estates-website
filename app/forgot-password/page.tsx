"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { createClient } from "../../lib/supabase/client";
import RecoveryLayout from "../components/RecoveryLayout";
import recoveryStyles from "../account-recovery.module.css";

const genericConfirmation =
  "If an eligible MZS account exists for this email address, you will receive password recovery instructions shortly. Please check your inbox and spam folder.";

export default function ForgotPasswordPage() {
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
        redirectTo: window.location.origin + "/reset-password",
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

          <form
            className="login-form"
            onSubmit={handleRequest}
            aria-busy={sending}
          >
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

      <Link href="/login" className={recoveryStyles.backLink}>
        ← Return to Cliënt &amp; Partner Login
      </Link>
    </RecoveryLayout>
  );
}
