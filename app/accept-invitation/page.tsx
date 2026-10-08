
"use client";

import { FormEvent, Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "../../lib/supabase/client";

type PageState =
  | "checking"
  | "ready"
  | "saving"
  | "success"
  | "invalid";

function InvitationForm() {
  const router = useRouter();

  const [pageState, setPageState] =
    useState<PageState>("checking");

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function checkInvitation() {
      const supabase = createClient();

      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (!active) return;

      if (authError || !user) {
        setPageState("invalid");
        return;
      }

      const { data: profile, error: profileError } =
        await supabase
          .from("profiles")
          .select("role, is_active")
          .eq("id", user.id)
          .single();

      if (!active) return;

      if (profileError || !profile) {
        setPageState("invalid");
        return;
      }

      // Invitation accounts must still be inactive.
      if (profile.is_active) {
        router.replace("/login?role=client");
        return;
      }

      setPageState("ready");
    }

    void checkInvitation();

    return () => {
      active = false;
    };
  }, [router]);

  async function handleActivation(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();
    setError("");

    if (password.length < 12) {
      setError("Please use at least 12 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setPageState("saving");

    const supabase = createClient();

    const { error: updateError } =
      await supabase.auth.updateUser({
        password,
      });

    if (updateError) {
      setError(
        "Unable to set your password. Please try again."
      );
      setPageState("ready");
      return;
    }

    // Profile activation is handled separately by MZS.
    await supabase.auth.signOut();

    setPageState("success");
  }

  return (
    <main className="login-page">
      <header className="login-header">
        <Link href="/" className="login-brand">
          MZS GROUP
        </Link>

        <span>Private Invitation</span>
      </header>

      <section className="login-container">
        <p className="eyebrow">By invitation only</p>

        {pageState === "checking" && (
          <>
            <h1>Verifying invitation.</h1>
            <p className="login-intro">
              Please wait while we verify your access.
            </p>
          </>
        )}

        {pageState === "invalid" && (
          <>
            <h1>Invitation unavailable.</h1>
            <p className="login-intro">
              This invitation is invalid, expired or has
              already been used. Please contact MZS Group.
            </p>
          </>
        )}

        {(pageState === "ready" ||
          pageState === "saving") && (
          <>
            <h1>Welcome to MZS.</h1>

            <p className="login-intro">
              Create your password to complete the
              first step of your account activation.
            </p>

            <form
              className="login-form"
              onSubmit={handleActivation}
            >
              <label>
                New Password
                <input
                  type="password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(event) =>
                    setPassword(event.target.value)
                  }
                  required
                  minLength={12}
                  disabled={pageState === "saving"}
                />
              </label>

              <label>
                Confirm Password
                <input
                  type="password"
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(event) =>
                    setConfirmPassword(event.target.value)
                  }
                  required
                  minLength={12}
                  disabled={pageState === "saving"}
                />
              </label>

              {error && (
                <p className="login-error" role="alert">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={pageState === "saving"}
              >
                {pageState === "saving"
                  ? "Saving..."
                  : "Set Password →"}
              </button>
            </form>
          </>
        )}

        {pageState === "success" && (
          <>
            <h1>Password created.</h1>

            <p className="login-intro">
              Your password has been saved.
              MZS Group will activate your private
              access once your account is approved
              for use.
            </p>

            <Link href="/" className="request-return">
              Return to MZS Group →
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

export default function AcceptInvitationPage() {
  return (
    <Suspense
      fallback={
        <main className="login-page">
          <p className="login-intro">
            Loading invitation...
          </p>
        </main>
      }
    >
      <InvitationForm />
    </Suspense>
  );
}
