
"use client";

import {
  FormEvent,
  Suspense,
  useEffect,
  useState,
} from "react";
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

  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] =
    useState("");

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

      const {
        data: profile,
        error: profileError,
      } = await supabase
        .from("profiles")
        .select("role, is_active, full_name")
        .eq("id", user.id)
        .single();

      if (!active) return;

      if (
        profileError ||
        !profile ||
        !["client", "partner"].includes(profile.role)
      ) {
        setPageState("invalid");
        return;
      }

      if (profile.is_active) {
        router.replace(
          profile.role === "partner"
            ? "/login?role=partner"
            : "/login?role=client"
        );
        return;
      }

      // Prefill the name from the invitation.
      setFullName(profile.full_name || "");
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

    if (pageState !== "ready") return;

    setError("");

    const normalizedName = fullName
      .trim()
      .replace(/\s+/g, " ");

    if (
      normalizedName.length < 3 ||
      normalizedName.length > 120 ||
      normalizedName.split(" ").length < 2
    ) {
      setError(
        "Please enter your full first and last name."
      );
      return;
    }

    if (password.length < 12) {
      setError(
        "Please use at least 12 characters."
      );
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setPageState("saving");

    const supabase = createClient();

    try {
      // Revalidate the authenticated user.
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !user) {
        setError(
          "Your session has expired. Please open your invitation again."
        );
        setPageState("invalid");
        return;
      }

      // Save the full name without changing
      // account role or activation status.
      const {
        data: nameSaved,
        error: nameError,
      } = await supabase.rpc(
        "complete_invitation_name",
        {
          p_full_name: normalizedName,
        }
      );

      if (nameError || nameSaved !== true) {
        setError(
          "Unable to save your full name. Please try again."
        );
        setPageState("ready");
        return;
      }

      // Set the password.
      const { error: passwordError } =
        await supabase.auth.updateUser({
          password,
        });

      if (passwordError) {
        setError(
          "Your name was saved, but the password could not be updated. Please try again."
        );
        setPageState("ready");
        return;
      }

      // Complete the approved invitation.
      // The database function validates the
      // invitation before activating the account.
      const {
        data: activated,
        error: activationError,
      } = await supabase.rpc(
        "finalize_invited_registration"
      );

      if (activationError || activated !== true) {
        setPassword("");
        setConfirmPassword("");

        setError(
          "Your password was saved, but automatic activation could not be completed. Please contact MZS Group. Do not create another account."
        );

        setPageState("invalid");
        return;
      }

      // End the registration session.
      const { error: signOutError } =
        await supabase.auth.signOut();

      setPassword("");
      setConfirmPassword("");

      if (signOutError) {
        setError(
          "Your account is active, but automatic sign out failed. Please sign out before logging in again."
        );
        setPageState("invalid");
        return;
      }

      setPageState("success");
    } catch {
      setPassword("");
      setConfirmPassword("");

      setError(
        "Unable to complete registration. Please contact MZS Group before trying again."
      );

      setPageState("invalid");
    }
  }

  const firstName =
    fullName.trim().split(/\s+/)[0] || "Member";

  return (
    <main className="login-page">
      <header className="login-header">
        <Link href="/" className="login-brand">
          MZS GROUP
        </Link>

        <span>Private Invitation</span>
      </header>

      <section className="login-container">
        <p className="eyebrow">
          By invitation only
        </p>

        {pageState === "checking" && (
          <>
            <h1>Verifying invitation.</h1>

            <p className="login-intro">
              Please wait while we verify
              your personal invitation.
            </p>
          </>
        )}

        {pageState === "invalid" && (
          <>
            <h1>Registration unavailable.</h1>

            <p className="login-intro">
              Your registration could not be
              completed or your invitation
              is no longer available.
            </p>

            {error && (
              <p
                className="login-error"
                role="alert"
              >
                {error}
              </p>
            )}

            <Link
              href="/"
              className="request-return"
            >
              Return to MZS Group →
            </Link>
          </>
        )}

        {(pageState === "ready" ||
          pageState === "saving") && (
          <>
            <h1>Welcome to MZS.</h1>

            <p className="login-intro">
              Complete your personal details
              and create a secure password
              to activate your private account.
            </p>

            <form
              className="login-form"
              onSubmit={handleActivation}
            >
              <label>
                Full Name
                <input
                  type="text"
                  autoComplete="name"
                  placeholder="First name and last name"
                  value={fullName}
                  onChange={(event) =>
                    setFullName(event.target.value)
                  }
                  maxLength={120}
                  required
                  disabled={pageState === "saving"}
                />
              </label>

              <label>
                New Password
                <input
                  type="password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(event) =>
                    setPassword(event.target.value)
                  }
                  minLength={12}
                  required
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
                  minLength={12}
                  required
                  disabled={pageState === "saving"}
                />
              </label>

              {error && (
                <p
                  className="login-error"
                  role="alert"
                >
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={pageState === "saving"}
              >
                {pageState === "saving"
                  ? "Activating..."
                  : "Activate My Account →"}
              </button>
            </form>
          </>
        )}

        {pageState === "success" && (
          <>
            <h1>Welcome, {firstName}.</h1>

            <p className="login-intro">
              Your personal MZS account
              has been successfully activated.
            </p>

            <p className="login-intro">
              You can now sign in to your
              private environment.

              Selected opportunities will
              become available when MZS Group
              assigns them to your account.
            </p>

            <Link
              href="/login?role=client"
              className="request-return"
            >
              Continue to Private Login →
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
