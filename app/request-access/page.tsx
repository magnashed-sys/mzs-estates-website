"use client";

import styles from "../public-access-refresh.module.css";

import { FormEvent, useState } from "react";
import Link from "next/link";
import PublicHeader from "../components/PublicHeader";
import HomeContactFooter from "../components/HomeContactFooter";

const interests = [
  { value: "investment", label: "Investment" },
  { value: "financing", label: "Financing" },
  { value: "sale", label: "Private Sale" },
  { value: "rental", label: "Private Rental" },
];

const pageStyle: React.CSSProperties = {
  position: "relative",
  isolation: "isolate",
  minHeight: "100svh",
  backgroundColor: "#0b0b0a",
  backgroundImage:
    "linear-gradient(90deg, rgba(7,9,10,.88) 0%, rgba(7,9,10,.73) 46%, rgba(7,9,10,.40) 100%), url('/images/request-access-bg.webp')",
  backgroundPosition: "center center",
  backgroundSize: "cover",
  backgroundRepeat: "no-repeat",
  color: "#f1ede6",
};

const contentStyle: React.CSSProperties = {
  position: "relative",
  zIndex: 1,
};

export default function RequestAccessPage() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [country, setCountry] = useState("");
  const [message, setMessage] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  function toggleInterest(value: string) {
    setSelectedInterests((current) =>
      current.includes(value)
        ? current.filter((item) => item !== value)
        : [...current, value]
    );
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading || submitted) return;
    setError("");
    if (password.length < 8) {
      setError("Please create a password of at least 8 characters.");
      return;
    }
    if (password !== passwordConfirmation) {
      setError("The passwords do not match.");
      return;
    }
    setLoading(true);
    try {
      const response = await fetch("/api/account/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({
          full_name: fullName, email, company, country,
          interests: selectedInterests, message,
          password, confirm_password: passwordConfirmation,
        }),
      });
      const result: { ok?: boolean; error?: string } = await response.json();
      if (!response.ok || !result.ok) {
        setError(result.error || "Unable to create your account. Please try again.");
        return;
      }
      setSubmitted(true);
      setPassword("");
      setPasswordConfirmation("");
    } catch {
      setError("Registration is temporarily unavailable. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (submitted) {
    return (
      <main className={`request-page ${styles.page} ${styles.requestPage}`} style={pageStyle}>
        <PublicHeader />
        <section className="request-success" style={contentStyle}>
          <p className="eyebrow">Account Created · Verification Required</p>
          <h1>Check your email.</h1>
          <p>Your MZS account has been created but remains inactive. Please verify your email address using the confirmation link we sent you.</p>
          <p className="request-success-note">After verification, MZS Group will review your account and chosen project access. You will receive an activation email when approved.</p>
          <Link href="/" className="request-return">Return to MZS Group →</Link>
        </section>
        <div className={styles.publicFooter}><HomeContactFooter email="info@mzsgroup.eu" /></div>
      </main>
    );
  }

  return (
    <main className={`request-page ${styles.page} ${styles.requestPage}`} style={pageStyle}>
      <PublicHeader />
      <section className="request-container" style={contentStyle}>
        <p className="eyebrow">Private Access</p>
        <h1>Your private journey begins here.</h1>
        <p className="request-intro">
          New relationships are considered on a selective basis. Registration will require email confirmation.
          Create a secure password and confirm your email address before MZS Group reviews your application.
        </p>
        <form className="request-form" onSubmit={handleSubmit} aria-busy={loading}>
          <div className="request-grid">
            <label>
              Full name
              <input type="text" autoComplete="name" value={fullName}
                onChange={(event) => setFullName(event.target.value)} required disabled={loading} />
            </label>
            <label>
              Email
              <input type="email" autoComplete="email" value={email}
                onChange={(event) => setEmail(event.target.value)} required disabled={loading} />
            </label>
            <label>
              Company (optional)
              <input type="text" autoComplete="organization" value={company}
                onChange={(event) => setCompany(event.target.value)} disabled={loading} />
            </label>
            <label>
              Country (optional)
              <input type="text" autoComplete="country-name" value={country}
                onChange={(event) => setCountry(event.target.value)} disabled={loading} />
            </label>
            <label>
              Create password (minimum 8 characters)
              <input type="password" autoComplete="new-password" minLength={8} maxLength={128}
                value={password} onChange={event => setPassword(event.target.value)}
                required disabled={loading} />
            </label>
            <label>
              Confirm password
              <input type="password" autoComplete="new-password" minLength={8} maxLength={128}
                value={passwordConfirmation} onChange={event => setPasswordConfirmation(event.target.value)}
                required disabled={loading} />
            </label>
          </div>
          <fieldset className="request-interests" disabled={loading}>
            <legend>Areas of interest</legend>
            <div className="interest-options">
              {interests.map((interest) => (
                <label key={interest.value}
                  className={selectedInterests.includes(interest.value)
                    ? "interest-option selected" : "interest-option"}>
                  <input type="checkbox"
                    checked={selectedInterests.includes(interest.value)}
                    onChange={() => toggleInterest(interest.value)} />
                  {interest.label}
                </label>
              ))}
            </div>
          </fieldset>
          <label className="request-message">
            How can MZS assist you? (optional)
            <textarea rows={4} value={message}
              onChange={(event) => setMessage(event.target.value)} disabled={loading} />
          </label>
          <p className="request-success-note">Your account remains inactive until email verification and individual MZS Group approval.</p>
          {error && <p className="login-error" role="alert">{error}</p>}
          <button type="submit" disabled={loading}>
            {loading ? "Creating account..." : "Create Account & Request Access →"}
          </button>
        </form>
      </section>
      <div className={styles.publicFooter}><HomeContactFooter email="info@mzsgroup.eu" /></div>
    </main>
  );
}
