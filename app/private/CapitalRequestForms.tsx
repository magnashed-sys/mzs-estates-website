"use client";
import {useTranslations, useLocale} from "next-intl";


import { useState, type FormEvent } from "react";
import styles from "./capitalRequests.module.css";

type Kind = "capital" | "possibilities";

function RequestForm({ kind }: { kind: Kind }) {
  const t = useTranslations("CapitalUI");
  const [amount, setAmount] = useState("");
  const [explanation, setExplanation] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState("");
  const [error, setError] = useState("");
  const title = kind === "capital" ? t("request_capital") : t("request_possibilities");
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
      if (!response.ok || !payload.recorded) {
        setError(t(response.status === 429 ? "rate" : response.status === 400 ? "details" : "failed"));
        return;
      }
      setResult(t("received", {id: payload.id || ""}));
      setAmount(""); setExplanation("");
    } catch (err) {
      setError(t("failed"));
    } finally { setBusy(false); }
  }
  return <article className={styles.card}>
    <span className={styles.kicker}>{t("enquiry")}</span>
    <h3>{title}</h3>
    <p>{kind === "capital"
      ? t("need")
      : t("opportunities")}</p>
    <form onSubmit={submit}>
      <label htmlFor={kind + "-amount"}>{kind === "capital" ? t("requested") : t("available")}</label>
      <input id={kind + "-amount"} type="number" inputMode="decimal" min="0.01" max="100000000000"
        step="0.01" required placeholder="€ 0.00" value={amount} onChange={e => setAmount(e.target.value)} />
      <label htmlFor={kind + "-explanation"}>{t("information")}</label>
      <textarea id={kind + "-explanation"} minLength={10} maxLength={4000} rows={5} required
        placeholder={kind === "capital" ? t("requirements") : t("preferences")}
        value={explanation} onChange={e => setExplanation(e.target.value)} />
      <button type="submit" disabled={busy}>{busy ? t("submitting") : t("submit")}</button>
      {error && <p role="alert" className={styles.error}>{error}</p>}
      {result && <p role="status" className={styles.success}>{result}</p>}
    </form>
  </article>;
}

export default function CapitalRequestForms() {
  const t = useTranslations("CapitalUI");
  return <section className={styles.section} aria-label={t("enquiries")}>
    <div className={styles.heading}><span className={styles.kicker}>{t("conversation")}</span>
      <h2>{t("assist")}</h2>
      <p>{t("direct")}</p>
    </div>
    <div className={styles.grid}><RequestForm kind="capital" /><RequestForm kind="possibilities" /></div>
  </section>;
}
