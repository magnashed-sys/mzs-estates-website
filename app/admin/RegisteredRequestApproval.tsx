"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { createClient } from "../../lib/supabase/client";
import { assertComplete } from "./admin-model";

type Role = "client" | "partner";
type Application = {
  id: string;
  full_name: string;
  email: string;
  status: string;
  auth_user_id?: string | null;
  email_verified_at?: string | null;
};
type Project = { id: string; title: string };
type Offering = {
  id: string; project_id: string; title: string | null;
  offering_type: string;
};
const gold = "#d5c09a";
const button: CSSProperties = {
  padding: "14px 22px", border: "1px solid #d5c09a", background: gold,
  color: "#0b0b0a", cursor: "pointer", fontSize: 12, letterSpacing: ".08em",
};

export default function RegisteredRequestApproval({
  request, onApproved, onClose,
}: {
  request: Application;
  onApproved: (id: string) => void;
  onClose: () => void;
}) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [offerings, setOfferings] = useState<Offering[]>([]);
  const [role, setRole] = useState<Role>("client");
  const [selected, setSelected] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const supabase = createClient();
        const { data: auth, error: authError } = await supabase.auth.getUser();
        if (authError || !auth.user) throw new Error("Sign in as administrator.");
        const { data: operator, error: operatorError } = await supabase.from("profiles")
          .select("role,is_active").eq("id", auth.user.id).single();
        if (operatorError || operator?.role !== "admin" || operator.is_active !== true) {
          throw new Error("Administrator access required.");
        }
        const results = await Promise.all([
          supabase.from("projects").select("id,title", { count: "exact" })
            .eq("status", "active").order("title"),
          supabase.from("offerings").select("id,project_id,title,offering_type", { count: "exact" })
            .eq("status", "active"),
        ]);
        assertComplete(results);
        if (!mounted) return;
        setProjects((results[0].data || []) as Project[]);
        setOfferings((results[1].data || []) as Offering[]);
      } catch (cause) {
        if (mounted) setError(cause instanceof Error ? cause.message : "Unable to load projects.");
      } finally {
        if (mounted) setLoading(false);
      }
    }
    void load();
    return () => { mounted = false; };
  }, []);

  function toggle(id: string) {
    setSelected(current => current.includes(id)
      ? current.filter(x => x !== id) : [...current, id]);
  }

  async function approve() {
    if (saving || completed || !request.email_verified_at || !request.auth_user_id ||
      request.status !== "pending" || selected.length === 0) return;
    const names = projects.filter(project =>
      offerings.some(offering => offering.project_id === project.id &&
        selected.includes(offering.id))).map(project => project.title);
    if (!window.confirm(
      "Approve and activate the verified account for " + request.full_name +
      "?\n\nSelected projects: " + names.join(", ") +
      "\n\nThe member will gain immediate private access. An activation email will be queued."
    )) return;
    setSaving(true); setError(""); setNotice("");
    try {
      const supabase = createClient();
      const { data, error: failure } = await supabase.rpc("approve_mzs_registered_request", {
        p_request_id: request.id, p_role: role, p_offering_ids: selected,
      });
      if (failure || data?.ok !== true) throw new Error("Approval was not confirmed. Please reload.");
      setCompleted(true);
      onApproved(request.id);
      // Email is best-effort. A delivery failure never undoes a committed approval.
      let mailText = "The activation email has been queued.";
      try {
        const { data: session } = await supabase.auth.getSession();
        if (session.session?.access_token && typeof data.mail_event_id === "string") {
          const response = await fetch("/api/account/notifications/dispatch", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: "Bearer " + session.session.access_token,
            },
            body: JSON.stringify({ event_id: data.mail_event_id }),
          });
          const result = await response.json();
          if (response.ok && result.status === "sent") mailText = "The activation email was sent.";
        }
      } catch {
        // The database outbox retains the notification for a scheduled retry.
      }
      setNotice("The account is active and the selected project access has been saved. " + mailText);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to confirm approval.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section style={{ marginTop: 28, border: "1px solid #514839", background: "#11100e",
      color: "#f4f0e7", padding: "clamp(18px,3vw,30px)" }}>
      <h3 style={{ fontFamily: "Georgia,serif", fontWeight: 400, fontSize: 27, marginTop: 0 }}>
        Verified account approval
      </h3>
      <p style={{ color: "#c1b9a9", lineHeight: 1.8 }}>
        {request.full_name} · {request.email}
      </p>
      <p role="status" style={{ color: request.email_verified_at ? gold : "#e3a995" }}>
        {request.email_verified_at
          ? "Email address verified · Account awaiting your approval"
          : "Email confirmation pending. Approval will be available after verification."}
      </p>
      {request.status !== "pending" && <p>Request already reviewed. Reload the dashboard.</p>}
      {loading ? <p>Loading opportunities…</p> : (
        <>
          <label style={{ display: "grid", gap: 9, maxWidth: 330, marginBottom: 25 }}>
            Account type
            <select value={role} disabled={saving || completed || request.status !== "pending"}
              onChange={event => setRole(event.target.value as Role)}
              style={{ background: "#171612", color: "#f4f0e7", border: "1px solid #514839", padding: 13 }}>
              <option value="client">Client</option>
              <option value="partner">Partner</option>
            </select>
          </label>
          <fieldset disabled={saving || completed || request.status !== "pending"}
            style={{ border: 0, padding: 0 }}>
            <legend style={{ color: gold, letterSpacing: ".1em", fontSize: 12, marginBottom: 15 }}>
              ASSIGN PRIVATE PROJECTS
            </legend>
            {projects.map(project => {
              const choices = offerings.filter(offering => offering.project_id === project.id);
              return choices.length ? (
                <div key={project.id} style={{ padding: "20px 0", borderTop: "1px solid #514839" }}>
                  <strong>{project.title}</strong>
                  <div style={{ display: "flex", gap: 18, flexWrap: "wrap", marginTop: 10 }}>
                    {choices.map(offering => (
                      <label key={offering.id} style={{ display: "flex", gap: 9, alignItems: "center" }}>
                        <input type="checkbox" checked={selected.includes(offering.id)}
                          onChange={() => toggle(offering.id)} />
                        {offering.offering_type}{offering.title ? " · " + offering.title : ""}
                      </label>
                    ))}
                  </div>
                </div>
              ) : null;
            })}
          </fieldset>
        </>
      )}
      {error && <p role="alert" style={{ color: "#e3a995" }}>{error}</p>}
      {notice && <p role="status" style={{ color: gold }}>{notice}</p>}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 20 }}>
        <button type="button" style={button}
          disabled={loading || saving || completed || !request.email_verified_at ||
            !request.auth_user_id || request.status !== "pending" ||
            selected.length === 0 || Boolean(error)}
          onClick={() => void approve()}>
          {saving ? "Activating…" : completed ? "Account activated" : "Approve, Assign & Activate →"}
        </button>
        <button type="button" onClick={onClose} disabled={saving}
          style={{ ...button, background: "transparent", color: gold }}>Close</button>
      </div>
      <p style={{ color: "#a9a398", fontSize: 12, marginTop: 25 }}>
        Account activation and project permissions are saved together.
        Email delivery is tracked separately and may be retried safely.
      </p>
    </section>
  );
}
