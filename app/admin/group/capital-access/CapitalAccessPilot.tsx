"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "../../../../lib/supabase/client";
import styles from "./capitalAccess.module.css";

type Candidate = {
  id: string;
  full_name: string;
  email: string;
  role: string;
  is_active: boolean;
};
type Assignment = { user_id: string; department: string; is_active: boolean };
type Audit = {
  id: number;
  target_user_id: string;
  department: string;
  new_active: boolean;
  changed_at: string;
};

export default function CapitalAccessPilot() {
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [audits, setAudits] = useState<Audit[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    const supabase = createClient();
    const [profiles, scopes, history] = await Promise.all([
      supabase.from("profiles")
        .select("id,full_name,email,role,is_active")
        .eq("is_active", true)
        .in("role", ["client", "partner"])
        .order("created_at", { ascending: false }).limit(200),
      supabase.from("mzs_admin_scope_assignments")
        .select("user_id,department,is_active").eq("department", "capital"),
      supabase.from("mzs_admin_scope_audit")
        .select("id,target_user_id,department,new_active,changed_at")
        .eq("department", "capital")
        .order("changed_at", { ascending: false }).limit(10),
    ]);
    if (profiles.error || scopes.error || history.error) {
      setState("error");
      return;
    }
    // Only explicitly marked synthetic accounts appear in this pilot.
    // The full RPC remains restricted to active Group Admins on the server.
    setCandidates(((profiles.data || []) as Candidate[]).filter(
      x => x.full_name.startsWith("Phase 3A Test ") && x.is_active
    ));
    setAssignments((scopes.data || []) as Assignment[]);
    setAudits((history.data || []) as Audit[]);
    setState("ready");
  }, []);

  useEffect(() => { void load(); }, [load]);
  const assignedIds = useMemo(() => new Set(assignments.filter(
    x => x.department === "capital" && x.is_active
  ).map(x => x.user_id)), [assignments]);
  const byId = useMemo(() => new Map(candidates.map(x => [x.id, x])), [candidates]);

  async function changeScope(candidate: Candidate, enabled: boolean) {
    if (busy) return;
    if (!candidate.is_active || !candidate.full_name.startsWith("Phase 3A Test ")) return;
    const action = enabled ? "GRANT" : "REVOKE";
    if (!window.confirm(`${action} Capital access for synthetic account ${candidate.email} in MZS Staging?`)) return;
    setBusy(candidate.id);
    setMessage("");
    try {
      const supabase = createClient();
      const { data, error } = await supabase.rpc("mzs_set_admin_department_scope", {
        p_target_user: candidate.id, p_department: "capital", p_enabled: enabled
      });
      if (error) throw error;
      await load();
      setMessage(data === true
        ? `Capital access ${enabled ? "granted" : "revoked"} and audited in Staging.`
        : "No permissions changed.");
    } catch {
      setMessage("Unable to confirm scope change. Refresh and verify audit before retrying.");
    } finally { setBusy(null); }
  }

  return <section className={styles.panel}>
    <h2>Synthetic staging accounts</h2>
    <p>Only active client/partner profiles whose full name begins with
      <strong> Phase 3A Test </strong>can be managed here. Create test identities using
      the supported Supabase Staging Auth tools before starting end-to-end tests.</p>
    {state === "loading" && <p>Loading Staging access assignments…</p>}
    {state === "error" && <p role="alert">Could not load Staging account permissions.</p>}
    {message && <p role="status" className={styles.notice}>{message}</p>}
    {state === "ready" && candidates.length === 0 &&
      <p>No active synthetic test accounts have been set up yet. No existing accounts were changed.</p>}
    {state === "ready" && candidates.map(person => {
      const active = assignedIds.has(person.id);
      return <div className={styles.account} key={person.id}>
        <div className={styles.identity}>
          <strong>{person.full_name}</strong>
          <small>{person.email}</small>
          <span>{active ? "Capital scope active" : "No Capital scope"}</span>
        </div>
        <button type="button" onClick={() => void changeScope(person, !active)}
          disabled={busy !== null} className={styles.action}>
          {busy === person.id ? "Updating…" : active ? "Revoke access" : "Grant Capital access"}
        </button>
      </div>;
    })}
    <h2>Recent scope changes</h2>
    {state === "ready" && audits.length === 0 && <p>No access changes recorded yet.</p>}
    {state === "ready" && audits.map(event => <p className={styles.audit} key={event.id}>
      {event.new_active ? "Granted" : "Revoked"} · {
        byId.get(event.target_user_id)?.email || "Staging user"
      } · {new Date(event.changed_at).toLocaleString("en-GB", { timeZone: "Europe/Madrid" })}
    </p>)}
  </section>;
}
