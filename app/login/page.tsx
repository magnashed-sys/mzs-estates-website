
"use client";

import { FormEvent, Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "../../lib/supabase/client";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const role =
    searchParams.get("role") === "partner"
      ? "Partner"
      : "Private Client";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (loading) return;

    setError("");
    setLoading(true);

    const supabase = createClient();

    try {
      // Authenticate user with Supabase
      const { data, error: authError } =
        await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });

      if (authError || !data.user) {
        setError("Invalid email or password.");
        return;
      }

      // Retrieve the authenticated user's profile
      const { data: profile, error: profileError } =
        await supabase
          .from("profiles")
          .select("role, is_active")
          .eq("id", data.user.id)
          .single();

      if (profileError || !profile) {
        await supabase.auth.signOut();
        setError(
          "Unable to verify your account. Please contact MZS Group."
        );
        return;
      }

      // Block inactive accounts
      if (!profile.is_active) {
        await supabase.auth.signOut();
        setError(
          "Your account is currently inactive. Please contact MZS Group."
        );
        return;
      }

      // Redirect according to the actual database role
      switch (profile.role) {
        case "admin":
          router.replace("/admin");
          break;

        case "client":
        case "partner":
          router.replace("/private");
          break;

        default:
          await supabase.auth.signOut();
          setError(
            "Your account does not have a valid access role."
          );
          return;
      }

      router.refresh();
    } catch (err) {
      console.error("Login error:", err);
      setError(
        "Unable to sign in at this time. Please try again."
      );
    } finally {
      setLoading(false);
    }
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
        <p className="eyebrow">{role} Access</p>

        <h1>Welcome back.</h1>

        <p className="login-intro">
          Access your private MZS environment.
        </p>

        <form
          className="login-form"
          onSubmit={handleLogin}
        >
          <label>
            Email
            <input
              type="email"
              name="email"
              autoComplete="email"
              value={email}
              onChange={(event) =>
                setEmail(event.target.value)
              }
              required
              disabled={loading}
            />
          </label>

          <label>
            Password
            <input
              type="password"
              name="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) =>
                setPassword(event.target.value)
              }
              required
              disabled={loading}
            />
          </label>

          {error && (
            <p className="login-error" role="alert">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
          >
            {loading ? "Signing in..." : "Login →"}
          </button>
        </form>

        <p className="login-note">
          Access is available to selected MZS clients
          and partners only.
        </p>
      </section>

      <footer className="login-footer">
        Private. Independent. International.
      </footer>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <main className="login-page">
          <p className="login-intro">
            Loading private access...
          </p>
        </main>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
