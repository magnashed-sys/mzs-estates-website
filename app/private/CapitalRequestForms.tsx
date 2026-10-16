"use client";

import { useState, type FormEvent } from "react";
import styles from "./capitalRequests.module.css";

type Kind = "capital" | "possibilities";

function RequestForm({ kind }: { kind: Kind }) {
  const [amount, setAmount] = useState("");
  const [explanation, setExplanation] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState("");
  const [error, setError] = useState("");
  const title = kind === "capital" ? "Request Capital" : "Request Possibilities";
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true); setError(""); setResult("");
    try {
      const response = await fetch("/api/capital-requests", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: kind, amount: Number(amount), explanation }),
      });
      const payload: { recorded?: boolean; error?: string; id?: string } = await response.json();
      if (!response.ok || !payload.recorded) throw new Error(payload.error || "Submission failed.");
      setResult("Your confidential request has been received. Reference: " + payload.id);
      setAmount(""); setExplanation("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to submit right now.");
    } finally { setBusy(false); }
  }
  return <article className={styles.card}>
    <span className={styles.kicker}>MZS CAPITAL / PRIVATE ENQUIRY</span>
    <h3>{title}</h3>
    <p>{kind === "capital"
      ? "Tell us about the private financing you require."
      : "Explore investment opportunities suited to your available capital."}</p>
    <form onSubmit={submit}>
      <label htmlFor={kind + "-amount"}>{kind === "capital" ? "Requested amount (EUR)" : "Available capital (EUR)"}</label>
      <input id={kind + "-amount"} type="number" inputMode="decimal" min="0.01" max="100000000000"
        step="0.01" required placeholder="€ 0.00" value={amount} onChange={e => setAmount(e.target.value)} />
      <label htmlFor={kind + "-explanation"}>Additional information</label>
      <textarea id={kind + "-explanation"} minLength={10} maxLength={4000} rows={5} required
        placeholder={kind === "capital" ? "Describe your financing requirements…" : "Tell us about your investment preferences…"}
        value={explanation} onChange={e => setExplanation(e.target.value)} />
      <button type="submit" disabled={busy}>{busy ? "Submitting…" : "Submit private request →"}</button>
      {error && <p role="alert" className={styles.error}>{error}</p>}
      {result && <p role="status" className={styles.success}>{result}</p>}
    </form>
  </article>;
}

export default function CapitalRequestForms() {
  return <section className={styles.section} aria-label="Private capital enquiries">
    <div className={styles.heading}><span className={styles.kicker}>A PRIVATE CONVERSATION</span>
      <h2>How can we assist you?</h2>
      <p>Submit your confidential enquiry directly to MZS Capital.</p>
    </div>
    <div className={styles.grid}><RequestForm kind="capital" /><RequestForm kind="possibilities" /></div>
  </section>;
}
