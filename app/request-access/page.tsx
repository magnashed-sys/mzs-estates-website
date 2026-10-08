"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { createClient } from "../../lib/supabase/client";

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
    if (loading) return;
    setLoading(true);
    setError("");

    try {
      const supabase = createClient();
      const { error: submitError } = await supabase
        .from("access_requests")
        .insert({
          full_name: fullName,
          email,
          company: company || null,
          country: country || null,
          interests: selectedInterests,
          message: message || null,
        });

      if (submitError) {
        console.error(submitError);
        setError("We were unable to submit your request. Please try again.");
        return;
      }
      setSubmitted(true);
    } catch (submitError) {
      console.error(submitError);
      setError("We were unable to submit your request. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (submitted) {
    return (
      <main className="request-page" style={pageStyle}>
        <header className="request-header" style={contentStyle}>
          <Link href="/" className="request-brand">MZS GROUP</Link>
          <span>Private Access</span>
        </header>
        <section className="request-success" style={contentStyle}>
          <p className="eyebrow">Request received</p>
          <h1>Thank you.</h1>
          <p>Your request has been received and will be reviewed individually by MZS Group.</p>
          <p className="request-success-note">Access is granted on a selective basis.</p>
          <Link href="/" className="request-return">Return to MZS Group →</Link>
        </section>
      </main>
    );
  }

  return (
    <main className="request-page" style={pageStyle}>
      <header className="request-header" style={contentStyle}>
        <Link href="/" className="request-brand">MZS GROUP</Link>
        <span>Request Access</span>
      </header>
      <section className="request-container" style={contentStyle}>
        <p className="eyebrow">Private Access</p>
        
<h1
  style={{
    fontSize: "clamp(38px, 4.5vw, 68px)",
    lineHeight: 1.08,
    letterSpacing: "-0.025em",
    maxWidth: "850px",
    margin: "18px 0 24px",
  }}
>
  Your private journey begins here.
</h1>

        <p className="request-intro">
          New relationships are considered on a selective basis.
          Please provide a few details below.
        </p>
        <form className="request-form" onSubmit={handleSubmit}>
          <div className="request-grid">
            <label>
              Name
              <input type="text" autoComplete="name" value={fullName}
                onChange={(event) => setFullName(event.target.value)} required disabled={loading} />
            </label>
            <label>
              Email
              <input type="email" autoComplete="email" value={email}
                onChange={(event) => setEmail(event.target.value)} required disabled={loading} />
            </label>
            <label>
              Company
              <input type="text" autoComplete="organization" value={company}
                onChange={(event) => setCompany(event.target.value)} disabled={loading} />
            </label>
            <label>
              Country
              <input type="text" autoComplete="country-name" value={country}
                onChange={(event) => setCountry(event.target.value)} disabled={loading} />
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
            How can MZS assist you?
            <textarea rows={4} value={message}
              onChange={(event) => setMessage(event.target.value)} disabled={loading} />
          </label>
          {error && <p className="login-error" role="alert">{error}</p>}
          <button type="submit" disabled={loading}>
            {loading ? "Submitting..." : "Submit Request →"}
          </button>
        </form>
      </section>
    </main>
  );
}
