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

    setLoading(true);
    setError("");

    const supabase = createClient();

    const { error } = await supabase.from("access_requests").insert({
      full_name: fullName,
      email,
      company: company || null,
      country: country || null,
      interests: selectedInterests,
      message: message || null,
    });

    if (error) {
      console.error(error);
      setError("We were unable to submit your request. Please try again.");
      setLoading(false);
      return;
    }

    setSubmitted(true);
    setLoading(false);
  }

  if (submitted) {
    return (
      <main className="request-page">
        <header className="request-header">
          <Link href="/" className="request-brand">
            MZS GROUP
          </Link>

          <span>Private Access</span>
        </header>

        <section className="request-success">
          <p className="eyebrow">Request received</p>

          <h1>Thank you.</h1>

          <p>
            Your request has been received and will be reviewed
            individually by MZS Group.
          </p>

          <p className="request-success-note">
            Access is granted on a selective basis.
          </p>

          <Link href="/" className="request-return">
            Return to MZS Group →
          </Link>
        </section>
      </main>
    );
  }

  return (
    <main className="request-page">
      <header className="request-header">
        <Link href="/" className="request-brand">
          MZS GROUP
        </Link>

        <span>Request Access</span>
      </header>

      <section className="request-container">
        <p className="eyebrow">Private Access</p>

        <h1>Request access.</h1>

        <p className="request-intro">
          New relationships are considered on a selective basis.
          Please provide a few details below.
        </p>

        <form className="request-form" onSubmit={handleSubmit}>
          <div className="request-grid">
            <label>
              Name
              <input
                type="text"
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
                required
              />
            </label>

            <label>
              Email
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            </label>

            <label>
              Company
              <input
                type="text"
                value={company}
                onChange={(event) => setCompany(event.target.value)}
              />
            </label>

            <label>
              Country
              <input
                type="text"
                value={country}
                onChange={(event) => setCountry(event.target.value)}
              />
            </label>
          </div>

          <fieldset className="request-interests">
            <legend>Areas of interest</legend>

            <div className="interest-options">
              {interests.map((interest) => (
                <label
                  key={interest.value}
                  className={
                    selectedInterests.includes(interest.value)
                      ? "interest-option selected"
                      : "interest-option"
                  }
                >
                  <input
                    type="checkbox"
                    checked={selectedInterests.includes(interest.value)}
                    onChange={() => toggleInterest(interest.value)}
                  />

                  {interest.label}
                </label>
              ))}
            </div>
          </fieldset>

          <label className="request-message">
            How can MZS assist you?
            <textarea
              rows={4}
              value={message}
              onChange={(event) => setMessage(event.target.value)}
            />
          </label>

          {error && <p className="login-error">{error}</p>}

          <button type="submit" disabled={loading}>
            {loading ? "Submitting..." : "Submit Request →"}
          </button>
        </form>
      </section>
    </main>
  );
}
