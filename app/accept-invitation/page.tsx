
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

      const { data: profile, error: profileError } =
        await supabase
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
        router.replace("/login?role=client");
        return;
      }

      // Prefill the name from the original invitation.
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
      setError("Please use at least 12 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setPageState("saving");

    const supabase = createClient();

    // Verify the authenticated invitation session.
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      setError(
        "Your invitation session has expired. Please request a new invitation."
      );
      setPageState("invalid");
      return;
    }

    // Store the full name without allowing changes
    // to the account role or activation status.
    const { data: nameSaved, error: nameError } =
      await supabase.rpc(
        "complete_invitation_name",
        {
          p_full_name: normalizedName,
        }
      );

    if (nameError || nameSaved !== true) {
      setError(
        "Unable to save your name. Please try again."
      );
      setPageState("ready");
      return;
    }

    // Set the account password.
    const { error: updateError } =
      await supabase.auth.updateUser({
        password,
      });

    if (updateError) {
      setError(
        "Your name was saved, but the password could not be set. Please try again."
      );
      setPageState("ready");
      return;
    }

    // Activation remains exclusively controlled by MZS.
    const { error: signOutError } =
      await supabase.auth.signOut();

    if (signOutError) {
      setError(
        "Your details were saved. Please sign out manually before continuing."
      );
      setPageState("ready");
      return;
    }

    setPassword("");
    setConfirmPassword("");
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
        <p className="eyebrow">
          By invitation only
        </p>

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
              This invitation is invalid, expired or
              no longer available. Please contact
              MZS Group.
            </p>
          </>
        )}

        {(pageState === "ready" ||
          pageState === "saving") && (
          <>
            <h1>Welcome to MZS.</h1>

            <p className="login-intro">
              Complete your personal details and
              create a secure password to begin
              your private MZS experience.
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
                  ? "Saving..."
                  : "Complete Registration →"}
              </button>
            </form>
          </>
        )}

        {pageState === "success" && (
          <>
            <h1>Registration complete.</h1>

            <p className="login-intro">
              Thank you, {fullName.trim().split(/\s+/)[0]}.
              Your personal details and password
              have been saved successfully.

              MZS Group will activate your private
              access once your account has been approved.
            </p>

            <Link
              href="/"
              className="request-return"
            >
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
