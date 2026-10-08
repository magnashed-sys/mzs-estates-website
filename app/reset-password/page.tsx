
"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "../../lib/supabase/client";

type Status = "checking" | "ready" | "saving" | "success" | "invalid";

export default function ResetPasswordPage() {
  const [status, setStatus] = useState<Status>("checking");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;

    async function verifySession() {
      const supabase = createClient();

      const { data, error } = await supabase.auth.getUser();

      if (!mounted) return;

      if (error || !data.user) {
        setStatus("invalid");
        return;
      }

      setStatus("ready");
    }

    void verifySession();

    return () => {
      mounted = false;
    };
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

    const supabase = createClient();

    const { error: updateError } =
      await supabase.auth.updateUser({
        password,
      });

    if (updateError) {
      setError("Unable to update your password. Please try again.");
      setStatus("ready");
      return;
    }

    await supabase.auth.signOut();
    setStatus("success");
  }

  return (
    <main className="login-page">
      <header className="login-header">
        <Link href="/" className="login-brand">
          MZS GROUP
        </Link>

        <span>Private Access</span>
      </header>

      <section className="login-container">
        <p className="eyebrow">Account Security</p>

        {status === "checking" && (
          <>
            <h1>Verifying access.</h1>
            <p className="login-intro">
              Please wait while we verify your recovery session.
            </p>
          </>
        )}

        {status === "invalid" && (
          <>
            <h1>Link unavailable.</h1>
            <p className="login-intro">
              Your recovery link may have expired.
              Please request a new password reset.
            </p>
            <Link href="/login" className="request-return">
              Return to Login →
            </Link>
          </>
        )}

        {(status === "ready" || status === "saving") && (
          <>
            <h1>Set new password.</h1>

            <p className="login-intro">
              Choose a secure password for your MZS account.
            </p>

            <form className="login-form" onSubmit={handleSubmit}>
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

              {error && (
                <p className="login-error" role="alert">
                  {error}
                </p>
              )}

              <button type="submit" disabled={status === "saving"}>
                {status === "saving"
                  ? "Saving..."
                  : "Update Password →"}
              </button>
            </form>
          </>
        )}

        {status === "success" && (
          <>
            <h1>Password updated.</h1>

            <p className="login-intro">
              Your password has been updated successfully.
              You can now return to the login page.
              Private access remains subject to MZS approval.
            </p>

            <Link href="/login" className="request-return">
              Return to Login →
            </Link>
          </>
        )}
      </section>

      <footer className="login-footer">
        Private. Independent. International.
      </footer>
    </main>
  );
}
