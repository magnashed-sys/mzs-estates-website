"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { createClient } from "../../lib/supabase/client";

type Role = "client" | "partner";
type Request = { id: string; full_name: string; email: string; status: string };
type Project = { id: string; title: string; location: string | null };
type Offering = { id: string; project_id: string; title: string | null; offering_type: string };
type Plan = { requested_role: Role; revision: number; applied_at: string | null };
export type PlannedInvitation = {
  id: string; request_id: string; email: string; requested_role: Role; status: string; invited_at: string;
};
type Props = {
  request: Request;
  onApproved: (id: string) => void;
  onInvited: (invitation: PlannedInvitation) => void;
  onClose: () => void;
};
const gold = "#d5c09a";
const muted = "#b4ac9f";
const edge = "#514839";
const button: CSSProperties = {
  padding: "13px 20px", border: `1px solid ${gold}`, background: "transparent", color: gold,
  fontSize: 12, lineHeight: 1.5, letterSpacing: ".07em", cursor: "pointer",
};
const labels: Record<string, string> = {
  rental: "Private Rental", sale: "Private Sale", investment: "Investment", financing: "Private Capital",
};
function sameIds(a: string[], b: string[]) {
  return a.length === b.length && [...a].sort().every((value, i) => value === [...b].sort()[i]);
}
function messageOf(error: unknown) {
  return error && typeof error === "object" && "message" in error && typeof error.message === "string"
    ? error.message : "The action could not be verified. Reload before another attempt.";
}

export default function RequestProjectApproval({ request, onApproved, onInvited, onClose }: Props) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [offerings, setOfferings] = useState<Offering[]>([]);
  const [role, setRole] = useState<Role>("client");
  const [selected, setSelected] = useState<string[]>([]);
  const [saved, setSaved] = useState<{ role: Role; ids: string[]; revision: number } | null>(null);
  const [invitation, setInvitation] = useState<PlannedInvitation | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [uncertain, setUncertain] = useState(false);
  const mounted = useRef(false);
  const actionLock = useRef(false);
  const loadGeneration = useRef(0);

  const load = useCallback(async () => {
    const generation = ++loadGeneration.current;
    const current = () => mounted.current && generation === loadGeneration.current;
    setLoading(true); setError("");
    try {
      const supabase = createClient();
      const { data: auth, error: authError } = await supabase.auth.getUser();
      if (authError || !auth.user) throw new Error("Sign in again as administrator.");
      const { data: profile, error: profileError } = await supabase.from("profiles")
        .select("role,is_active").eq("id", auth.user.id).single();
      if (profileError || profile?.role !== "admin" || profile.is_active !== true)
        throw new Error("Active administrator access is required.");
      const [p, o, plan, entries, existing] = await Promise.all([
        supabase.from("projects").select("id,title,location", { count: "exact" }).eq("status", "active").order("title"),
        supabase.from("offerings").select("id,project_id,title,offering_type", { count: "exact" }).eq("status", "active").order("title"),
        supabase.from("access_request_access_plans").select("requested_role,revision,applied_at").eq("request_id", request.id).maybeSingle(),
        supabase.from("access_request_offering_plans").select("offering_id", { count: "exact" }).eq("request_id", request.id),
        supabase.from("access_invitations").select("id,request_id,email,requested_role,status,invited_at").eq("request_id", request.id).maybeSingle(),
      ]);
      if (!current()) return;
      if ([p,o,plan,entries,existing].some(result => result.error)) throw new Error("Unable to load the access selection. No changes were made.");
      if ([p,o,entries].some(result => result.count !== null && result.count > (result.data?.length ?? 0)))
        throw new Error("The opportunity list is incomplete. Do not save; pagination is required.");
      const planRow = plan.data as Plan | null;
      const ids = (entries.data ?? []).map(x => x.offering_id as string);
      setProjects((p.data ?? []) as Project[]); setOfferings((o.data ?? []) as Offering[]);
      setRole(planRow?.requested_role ?? "client"); setSelected(ids);
      setSaved(planRow ? { role: planRow.requested_role, ids, revision: planRow.revision } : null);
      setInvitation(existing.data as PlannedInvitation | null);
    } catch (cause) { if (current()) setError(messageOf(cause)); }
    finally { if (current()) setLoading(false); }
  }, [request.id]);
  useEffect(() => {
    mounted.current = true; void load();
    return () => { mounted.current = false; loadGeneration.current += 1; };
  }, [load]);

  const selectable = offerings.filter(o => projects.some(p => p.id === o.project_id));
  const dirty = !saved || saved.role !== role || !sameIds(saved.ids, selected);
  const unavailableSaved = selected.some(id => !selectable.some(o => o.id === id));
  const locked = busy || loading || Boolean(invitation) || uncertain || Boolean(error);
  const selectionText = () => selected.map(id => {
    const offering = selectable.find(o => o.id === id);
    return `${projects.find(p => p.id === offering?.project_id)?.title ?? "Unavailable project"} — ${labels[offering?.offering_type ?? ""] ?? offering?.title ?? "Opportunity"}`;
  }).join("\n") || "No projects. The member will see an empty collection.";

  async function approveAndSave() {
    if (actionLock.current || locked || unavailableSaved) return;
    if (!window.confirm(`Approve ${request.full_name} (${request.email}) as ${role.toUpperCase()} and save this access selection?\n\n${selectionText()}\n\nThis does not send an email. The selected rights are attached when the invitation account is created.`)) return;
    actionLock.current = true; setBusy(true); setError(""); setNotice("");
    try {
      const { data, error: rpcError } = await createClient().rpc("approve_access_request_with_projects", {
        p_request_id: request.id, p_role: role, p_offering_ids: selected,
        p_expected_revision: saved?.revision ?? 0,
      });
      if (rpcError) throw rpcError;
      if (!data || data.ok !== true || typeof data.revision !== "number") throw new Error("Approval outcome could not be verified.");
      if (!mounted.current) return;
      onApproved(request.id);
      setSaved({ role, ids: [...selected], revision: data.revision });
      setNotice("Request approved and access selection saved. No invitation has been sent yet.");
      await load();
    } catch (cause) { if (mounted.current) { setError(messageOf(cause)); } }
    finally { actionLock.current = false; if (mounted.current) setBusy(false); }
  }

  async function sendInvitation() {
    if (actionLock.current || locked || dirty || !saved || unavailableSaved) return;
    if (!window.confirm(`Send one ${role.toUpperCase()} invitation email to ${request.full_name} (${request.email})?\n\n${selectionText()}\n\nThis sends a real registration email, not a booking. Do not invite external testers before the pilot security checks are complete.`)) return;
    actionLock.current = true; setBusy(true); setError(""); setNotice("");
    let invoked = false;
    try {
      const supabase = createClient();
      const { data: plan, error: planError } = await supabase.from("access_request_access_plans")
        .select("revision,requested_role").eq("request_id", request.id).single();
      if (planError || plan?.revision !== saved.revision || plan.requested_role !== role)
        throw new Error("The access plan changed. Reload and review it before sending.");
      // The existing Edge Function enforces admin access and unique invitations.
      invoked = true;
      const { data, error: invokeError } = await supabase.functions.invoke("invite-approved-relationship", {
        body: { request_id: request.id, role },
      });
      const { data: updated, error: readError } = await supabase.from("access_invitations")
        .select("id,request_id,email,requested_role,status,invited_at").eq("request_id", request.id).maybeSingle();
      if (!mounted.current) return;
      if (updated) { setInvitation(updated as PlannedInvitation); onInvited(updated as PlannedInvitation); }
      if (readError || invokeError || data?.ok !== true || updated?.status !== "sent") {
        setUncertain(true);
        throw new Error("The invitation outcome needs administrator review. Do not resend automatically; inspect the recorded invitation first.");
      }
      const { data: applied, error: appliedError } = await supabase.from("access_request_access_plans")
        .select("applied_at,applied_user_id").eq("request_id", request.id).single();
      if (!mounted.current) return;
      if (appliedError || !applied?.applied_at || !applied.applied_user_id) {
        setUncertain(true);
        throw new Error("The invitation was sent, but assigned access could not be verified. Review before activation.");
      }
      setNotice("Invitation sent. The selected project and offering rights are attached to the new account. Registration remains a separate step.");
    } catch (cause) {
      if (mounted.current) { setError(messageOf(cause)); if (invoked) setUncertain(true); }
    } finally { actionLock.current = false; if (mounted.current) setBusy(false); }
  }

  return <section aria-label={`Review access for ${request.full_name}`} style={{ marginTop: 28, padding: "clamp(18px,3vw,30px)", border: `1px solid ${edge}`, background: "#11110f", color: "#eeeae2" }}>
    <div style={{ display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap", alignItems: "center" }}>
      <h4 style={{ fontFamily: "Georgia,serif", fontSize: 26, fontWeight: 400, margin: 0 }}>Approval & project access</h4>
      <button type="button" style={button} onClick={onClose} disabled={busy}>Close</button>
    </div>
    <p style={{ color: muted, lineHeight: 1.7 }}>Select only the opportunities this member may see. Interests on the application do not grant access automatically.</p>
    {loading && <p role="status">Loading approved access...</p>}
    {error && <p role="alert" style={{ color: "#e3a995", lineHeight: 1.8 }}>{error}</p>}
    {notice && <p role="status" style={{ color: gold, lineHeight: 1.8 }}>{notice}</p>}
    {!loading && <>
      <label style={{ display: "grid", gap: 10, maxWidth: 320, marginBottom: 26 }}>
        Account type
        <select value={role} disabled={locked} onChange={e => setRole(e.target.value as Role)} style={{ padding: 14, color: "#eeeae2", background: "#151411", border: `1px solid ${edge}`, fontSize: 15 }}>
          <option value="client">Client</option><option value="partner">Partner</option>
        </select>
      </label>
      <fieldset disabled={locked} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
        <legend style={{ color: gold, fontSize: 12, letterSpacing: ".1em", marginBottom: 16 }}>PROJECTS & OPPORTUNITIES</legend>
        {projects.filter(p => selectable.some(o => o.project_id === p.id)).map(project => <div key={project.id} style={{ padding: "20px 0", borderTop: `1px solid ${edge}` }}>
          <strong style={{ fontSize: 16 }}>{project.title}</strong>
          <p style={{ color: muted, margin: "6px 0 14px", fontSize: 13 }}>{project.location}</p>
          <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
            {selectable.filter(o => o.project_id === project.id).map(offering => <label key={offering.id} style={{ display: "inline-flex", alignItems: "center", gap: 10, minHeight: 40 }}>
              <input type="checkbox" checked={selected.includes(offering.id)} onChange={e => setSelected(current => e.target.checked ? [...current, offering.id] : current.filter(id => id !== offering.id))} style={{ width: 18, height: 18, accentColor: gold }} />
              {labels[offering.offering_type] ?? offering.title ?? offering.offering_type}
            </label>)}
          </div>
        </div>)}
        {!selectable.length && <p>No active opportunities are available.</p>}
      </fieldset>
      {unavailableSaved && <p role="alert" style={{ color: "#e3a995" }}>A saved opportunity is no longer active. Review its status before changing this plan.</p>}
      <p style={{ color: muted, lineHeight: 1.8 }}>{selected.length} selected opportunities. No selection means no project access. Future opportunities are not included automatically.</p>
      {invitation ? <p style={{ color: gold, lineHeight: 1.8 }}>Invitation status: {invitation.status}. This initial selection is locked. Use Project Access Management for later changes.</p> : <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 20 }}>
        <button type="button" style={{ ...button, background: gold, color: "#111", opacity: locked || unavailableSaved ? .5 : 1 }} disabled={locked || unavailableSaved} onClick={() => void approveAndSave()}>{busy ? "Processing..." : saved ? "Save approved selection" : "Approve & save selection"}</button>
        <button type="button" style={{ ...button, opacity: locked || dirty || !saved || unavailableSaved ? .5 : 1 }} disabled={locked || dirty || !saved || unavailableSaved} onClick={() => void sendInvitation()}>Send invitation →</button>
      </div>}
      {error && <button type="button" style={{ ...button, marginTop: 16 }} disabled={busy || loading} onClick={() => void load()}>Reload recorded status</button>}
      <p style={{ color: muted, fontSize: 12, lineHeight: 1.8, marginTop: 22 }}>Saving approval does not send an email. Sending requires a second confirmation. Selecting access never creates or confirms a rental booking.</p>
    </>}
  </section>;
}
