"use client";
import {useAdminI18n} from '../../../lib/admin/i18n';


import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "../../../lib/supabase/client";
import styles from "./requests.module.css";

type RequestRecord = {
  id: string; user_id: string; request_type: "capital" | "possibilities";
  amount_eur: number; explanation: string; status: string;
  email_status: string; created_at: string;
  member_name: string | null; member_email: string | null;
};
const stages = ["new", "in_review", "contacted", "closed"];

export default function CapitalRequestsAdmin() {
 const {t:adminT,locale:adminLocale}=useAdminI18n();

  const [items, setItems] = useState<RequestRecord[]>([]);
  const [state, setState] = useState<"loading" | "denied" | "error" | "ready">("loading");
  const [busy, setBusy] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    const supabase = createClient();
    const { data: auth, error: authError } = await supabase.auth.getUser();
    if (authError || !auth.user) { setState("denied"); return; }
    // Scoped read is a database-owned projection: department staff cannot
    // SELECT unrelated profiles, bypass RLS, or alter Capital request rows.
    const { data, error } = await supabase.rpc("mzs_capital_admin_list_requests");
    if (error) {
      setState(error.code === "42501" ? "denied" : "error");
      return;
    }
    setItems((data || []) as RequestRecord[]);
    setState("ready");
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function update(id: string, status: string) {
    if (busy || !stages.includes(status)) return;
    setBusy(id);
    setNotice("");
    try {
      const response = await fetch("/api/capital-requests/admin", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status })
      });
      if (!response.ok) throw new Error("Update not confirmed.");
      await load();
      setNotice("Status confirmed.");
    } catch {
      setNotice("Could not confirm update. Reload before retrying.");
    } finally {
      setBusy("");
    }
  }

  return <main className={styles.page}>
    <Link href="/admin/group/capital">{adminT("← MZS Capital Cockpit")}</Link>
    <p className={styles.kicker}>{adminT("MZS CAPITAL / ADMINISTRATION")}</p>
    <h1>{adminT("Capital Requests")}</h1>
    <p>{adminT("Private financing enquiries and available investment capital.")}</p>
    {state === "loading" && <p>{adminT("Loading requests…")}</p>}
    {state === "denied" && <p>{adminT("Active Capital or Group Administrator access required.")}</p>}
    {state === "error" && <p>{adminT("Unable to load capital requests.")}</p>}
    {notice && <p role="status">{adminT(notice)}</p>}
    {state === "ready" && (items.length === 0 ? <p>{adminT("No capital requests received yet.")}</p> :
      <div className={styles.list}>{items.map(item => <article key={item.id} className={styles.card}>
        <div className={styles.top}>
          <strong>{item.request_type === "capital" ? adminT("Request Capital") : adminT("Request Possibilities")}</strong>
          <span>{new Date(item.created_at).toLocaleString(adminLocale, { timeZone: "Europe/Madrid" })}</span>
        </div>
        <h2>{new Intl.NumberFormat(adminLocale, { style: "currency", currency: "EUR" }).format(item.amount_eur)}</h2>
        <p>{[item.member_name || "Member", item.member_email].filter(Boolean).join(" · ")}</p>
        <p className={styles.explanation}>{item.explanation}</p>
        <p>{adminT("Admin email:")} {adminT(item.email_status)}</p>
        <label>{adminT("Status")} <select aria-label={adminT("Status for {p0}", {p0: item.id})} value={item.status}
          onChange={e => void update(item.id, e.target.value)} disabled={busy !== ""}>
          {stages.map(s => <option key={s} value={s}>{adminT(s.replaceAll("_", " "))}</option>)}
        </select></label>
        <small>{adminT("Reference:")} {item.id}</small>
      </article>)}</div>)}
  </main>;
}
