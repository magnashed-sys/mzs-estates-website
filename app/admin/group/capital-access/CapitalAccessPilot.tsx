"use client";
import {useAdminI18n} from '../../../../lib/admin/i18n';


import { useCallback, useEffect, useState } from "react";
import { createClient } from "../../../../lib/supabase/client";
import styles from "./capitalAccess.module.css";

type Candidate = {
  user_id: string;
  full_name: string;
  email: string;
  is_active: boolean;
  has_capital_scope: boolean;
};

type Audit = {
  id: number;
  target_user_id: string;
  department: string;
  new_active: boolean;
  changed_at: string;
};

export default function CapitalAccessPilot() {
 const {t:adminT,locale:adminLocale}=useAdminI18n();

  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [audits, setAudits] = useState<Audit[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    const supabase = createClient();
    // Trusted Auth app_metadata and an isolated test email are validated
    // in the Staging SECURITY DEFINER RPC; ordinary user-editable names
    // or user_metadata are never sufficient for a pilot grant.
    const [accounts, history] = await Promise.all([
      supabase.rpc("mzs_phase3a_pilot_list_capital_accounts"),
      supabase.from("mzs_admin_scope_audit")
        .select("id,target_user_id,department,new_active,changed_at")
        .eq("department", "capital")
        .order("changed_at", { ascending: false }).limit(10),
    ]);
    if (accounts.error || history.error) {
      setState("error");
      return;
    }
    setCandidates((accounts.data || []) as Candidate[]);
    setAudits((history.data || []) as Audit[]);
    setState("ready");
  }, []);

  useEffect(() => { void load(); }, [load]);
  const names = new Map(candidates.map(x => [x.user_id, x.email]));

  async function changeScope(candidate: Candidate, enabled: boolean) {
    if (busy || !candidate.is_active) return;
    const action = enabled ? "GRANT" : "REVOKE";
    if (!window.confirm(adminT("{p0} Capital access for the synthetic Staging identity {p1}?", {p0: action, p1: candidate.email}))) return;
    setBusy(candidate.user_id);
    setMessage("");
    try {
      const supabase = createClient();
      // The RPC re-checks signed-in Group Admin status and Auth app_metadata.
      // It delegates to the audited scope grant/revocation transaction.
      const { data, error } = await supabase.rpc("mzs_phase3a_pilot_set_capital_scope", {
        p_target_user: candidate.user_id, p_enabled: enabled
      });
      if (error) throw error;
      await load();
      setMessage(data === true
        ? `Capital access ${enabled ? "granted" : "revoked"} and audited in Staging.`
        : "No permissions changed.");
    } catch {
      setMessage("Unable to confirm scope change. Reload and check the audit before retrying.");
    } finally { setBusy(null); }
  }

  return <section className={styles.panel}>
    <h2>{adminT("Trusted Staging test accounts")}</h2>
    <p>{adminT("Only active test identities provisioned by the Staging Auth Administrator, marked with private application metadata and a dedicated test email, may receive Capital rights through this pilot. Profile names alone are not accepted.")}</p>
    {state === "loading" && <p>{adminT("Loading Staging test accounts…")}</p>}
    {state === "error" && <p role="alert">{adminT("Unable to verify Staging test accounts and permissions.")}</p>}
    {message && <p role="status" className={styles.notice}>{adminT(message)}</p>}
    {state === "ready" && candidates.length === 0 &&
      <p>{adminT("No trusted test identities are registered yet. No client accounts have been changed.")}</p>}
    {state === "ready" && candidates.map(person =>
      <div className={styles.account} key={person.user_id}>
        <div className={styles.identity}>
          <strong>{person.full_name}</strong>
          <small>{person.email}</small>
          <span>{person.has_capital_scope ? adminT("Capital scope active") : adminT("No Capital scope")}</span>
        </div>
        <button type="button"
          onClick={() => void changeScope(person, !person.has_capital_scope)}
          disabled={busy !== null || !person.is_active} className={styles.action}>
          {busy === person.user_id ? adminT("Updating…") :
            person.has_capital_scope ? adminT("Revoke access") : adminT("Grant Capital access")}
        </button>
      </div>)}
    <h2>{adminT("Recent scope changes")}</h2>
    {state === "ready" && audits.length === 0 && <p>{adminT("No access changes recorded yet.")}</p>}
    {state === "ready" && audits.map(event =>
      <p className={styles.audit} key={event.id}>
        {event.new_active ? adminT("Granted") : adminT("Revoked")} · {
          names.get(event.target_user_id) || adminT("Staging account")
        } · {new Date(event.changed_at).toLocaleString(adminLocale, {
          timeZone: "Europe/Madrid"
        })}
      </p>)}
  </section>;
}
