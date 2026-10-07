"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

function LoginForm() {
  const searchParams = useSearchParams();
  const role =
    searchParams.get("role") === "partner" ? "Partner" : "Private Client";

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

        <form className="login-form">
          <label>
            Email
            <input
              type="email"
              name="email"
              autoComplete="email"
              placeholder="name@email.com"
            />
          </label>

          <label>
            Password
            <input
              type="password"
              name="password"
              autoComplete="current-password"
              placeholder="••••••••"
            />
          </label>

          <button type="button">Login →</button>
        </form>

        <p className="login-note">
          Access is available to selected MZS clients and partners only.
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
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
