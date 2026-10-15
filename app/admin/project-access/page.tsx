"use client";

import { useCallback, useEffect, useRef, useState, type MouseEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "../../../lib/supabase/client";
import { assertComplete, matchesSearch, sameIds } from "../admin-model";
import "../admin.css";

type Profile = { id: string; full_name: string | null; email: string; role: string; is_active: boolean };
type Project = { id: string; title: string; location: string | null; status: string };
type Offering = { id: string; project_id: string; title: string; offering_type: string; status: string };
type ProjectGrant = { user_id: string; project_id: string };
type OfferingGrant = { user_id: string; offering_id: string };
type Data = { profiles: Profile[]; projects: Project[]; offerings: Offering[]; projectGrants: ProjectGrant[]; offeringGrants: OfferingGrant[] };
const labels: Record<string, string> = { investment: "Investment", sale: "Private Sale", rental: "Private Rental", financing: "Private Capital" };
function grantedIds(data: Data, user: string, project: string) {
  if (!data.projectGrants.some(g => g.user_id === user && g.project_id === project)) return [];
  const ids = new Set(data.offerings.filter(o => o.project_id === project).map(o => o.id));
  return data.offeringGrants.filter(g => g.user_id === user && ids.has(g.offering_id)).map(g => g.offering_id);
}

export default function ProjectAccessPage() {
  const router = useRouter();
  const [data, setData] = useState<Data | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "denied" | "error">("loading");
  const [selectedUser, setSelectedUser] = useState("");
  const [selectedProject, setSelectedProject] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const mounted = useRef(false);
  const generation = useRef(0);
  const actionLock = useRef(false);

  const load = useCallback(async (userId = "", projectId = "") => {
    const version = ++generation.current;
    const current = () => mounted.current && generation.current === version;
    setState("loading"); setError("");
    try {
      const supabase = createClient();
      const { data: auth, error: authError } = await supabase.auth.getUser();
      if (!current()) return;
      if (authError || !auth.user) { router.replace("/login"); return; }
      const { data: profile, error: profileError } = await supabase.from("profiles").select("role,is_active").eq("id", auth.user.id).single();
      if (!current()) return;
      if (profileError || profile?.role !== "admin" || profile.is_active !== true) { setState("denied"); return; }
      const results = await Promise.all([
        supabase.from("profiles").select("id,full_name,email,role,is_active", { count: "exact" }).in("role", ["client", "partner"]).order("full_name"),
        supabase.from("projects").select("id,title,location,status", { count: "exact" }).eq("status", "active").order("title"),
        supabase.from("offerings").select("id,project_id,title,offering_type,status", { count: "exact" }).order("title"),
        supabase.from("project_access").select("user_id,project_id", { count: "exact" }),
        supabase.from("offering_access").select("user_id,offering_id", { count: "exact" }),
      ]);
      if (!current()) return;
      assertComplete(results);
      const next: Data = { profiles: (results[0].data ?? []) as Profile[], projects: (results[1].data ?? []) as Project[], offerings: (results[2].data ?? []) as Offering[], projectGrants: (results[3].data ?? []) as ProjectGrant[], offeringGrants: (results[4].data ?? []) as OfferingGrant[] };
      const user = next.profiles.some(p => p.id === userId) ? userId : "";
      const project = next.projects.some(p => p.id === projectId) ? projectId : "";
      setData(next); setSelectedUser(user); setSelectedProject(project); setSelected(grantedIds(next, user, project));
      setUncertain(false); setNotice(""); setState("ready");
    } catch (cause) { if (current()) { setError(cause instanceof Error ? cause.message : "Unable to load permissions."); setState("error"); } }
  }, [router]);

  useEffect(() => {
    mounted.current = true;
    const params = new URLSearchParams(window.location.search);
    void load(params.get("user") ?? "", params.get("project") ?? "");
    return () => { mounted.current = false; generation.current += 1; };
  }, [load]);

  const initial = data ? grantedIds(data, selectedUser, selectedProject) : [];
  const dirty = !sameIds(initial, selected);
  useEffect(() => {
    if (!dirty && !saving) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty, saving]);

  function canLeave() { return !saving && (!dirty || window.confirm("Discard the unsaved access selection?")); }
  function guardLink(event: MouseEvent<HTMLAnchorElement>) { if (!canLeave()) event.preventDefault(); }
  function choose(user: string, project: string) {
    if (!data || !canLeave()) return;
    setSelectedUser(user); setSelectedProject(project); setSelected(grantedIds(data, user, project)); setNotice("");
  }
  const profile = data?.profiles.find(p => p.id === selectedUser);
  const project = data?.projects.find(p => p.id === selectedProject);
  const available = data?.offerings.filter(o => o.project_id === selectedProject && o.status === "active") ?? [];
  const inactiveGrants = initial.filter(id => !available.some(o => o.id === id));
  const added = available.filter(o => selected.includes(o.id) && !initial.includes(o.id));
  const removed = available.filter(o => initial.includes(o.id) && !selected.includes(o.id));
  const title = (o: Offering) => `${labels[o.offering_type] ?? o.offering_type}${o.title ? ` — ${o.title}` : ""}`;

  async function save() {
    if (actionLock.current || saving || uncertain || !data || !profile || !project || !dirty || inactiveGrants.length) return;
    const expected = [...selected];
    const userId = profile.id, projectId = project.id;
    const description = `Account: ${profile.email}\nProject: ${project.title}\n\nAdd: ${added.map(title).join(", ") || "None"}\nRemove: ${removed.map(title).join(", ") || "None"}${expected.length ? "" : "\n\nAll access to this project will be removed."}`;
    if (!window.confirm(`Save these access changes?\n\n${description}`)) return;
    actionLock.current = true; setSaving(true); setNotice("");
    try {
      const supabase = createClient();
      // Save and start the notification from one authenticated server request.
      // Even if SMTP fails, permissions remain committed and the email is queued.
      const response = await fetch("/api/account/access/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({
          user_id: userId, project_id: projectId, offering_ids: expected,
        }),
      });
      const result: {
        ok?: boolean;
        grantedCount?: number;
        emailStatus?: "none" | "sent" | "queued";
        emailsAccepted?: number;
      } = await response.json();
      if (!response.ok || result.ok !== true ||
          result.grantedCount !== expected.length) {
        throw new Error("Save could not be confirmed. Refresh permissions.");
      }
      const [pg, og] = await Promise.all([
        supabase.from("project_access").select("user_id,project_id", { count: "exact" }).eq("user_id", userId).eq("project_id", projectId),
        supabase.from("offering_access").select("user_id,offering_id", { count: "exact" }).eq("user_id", userId),
      ]);
      if (!mounted.current) return;
      assertComplete([pg, og]);
      const allProjectIds = new Set(data.offerings.filter(o => o.project_id === projectId).map(o => o.id));
      const verified = ((og.data ?? []) as OfferingGrant[]).filter(g => allProjectIds.has(g.offering_id));
      if (!sameIds(expected, verified.map(g => g.offering_id)) || (pg.data?.length ?? 0) !== (expected.length ? 1 : 0)) throw new Error("Saved permissions differ from the selection");
      setData(current => current && ({ ...current,
        projectGrants: [...current.projectGrants.filter(g => !(g.user_id === userId && g.project_id === projectId)), ...((pg.data ?? []) as ProjectGrant[])],
        offeringGrants: [...current.offeringGrants.filter(g => !(g.user_id === userId && allProjectIds.has(g.offering_id))), ...verified],
      }));
      // The server already dispatched (or safely queued) any new-access
      // notification. Do not send again from the browser.
      let mailNotice = "";
      if (result.emailStatus === "sent") {
        mailNotice = " The new-access email was accepted by the mail server.";
      } else if (result.emailStatus === "queued") {
        mailNotice = " The new-access email remains queued for delivery.";
      }
      setSelected(expected);
      setNotice("Project access saved and verified." + mailNotice);
    } catch {
      if (mounted.current) { setUncertain(true); setNotice("The final access state could not be verified. Refresh permissions before another change. The save may already have completed."); }
    } finally { actionLock.current = false; if (mounted.current) setSaving(false); }
  }

  if (state !== "ready" || !data) return <main className="admin-page"><div className="admin-message"><h1>{state === "denied" ? "Access restricted." : state === "error" ? "Unable to load." : "Preparing permissions."}</h1><p role={state === "error" ? "alert" : "status"}>{state === "error" ? error : state === "denied" ? "Active administrator access is required." : "Verifying administrator access…"}</p>{state === "error" && <button className="admin-button" onClick={() => void load(selectedUser, selectedProject)}>Try again</button>}<Link href="/admin?tab=projects">Return to Admin →</Link></div></main>;

  return <main className="admin-page"><header className="admin-header"><Link href="/" onClick={guardLink} className="admin-brand">MZS GROUP</Link><Link className="admin-button" href="/admin?tab=projects" onClick={guardLink}>← Admin dashboard</Link></header><section className="admin-content">
    <div className="admin-heading-row"><div><p className="eyebrow">Selected relationships</p><h1>Project access.</h1><p className="admin-intro">Choose a relationship and review exactly which opportunities they can access.</p></div><button className="admin-button" disabled={saving} onClick={() => { if (canLeave()) void load(selectedUser, selectedProject); }}>Refresh permissions</button></div>
    <div className="admin-access-layout">
      <aside className="admin-panel"><h2 className="admin-subtitle">Select a relationship.</h2><label className="admin-field">Search<input type="search" disabled={saving || uncertain} value={search} placeholder="Name or email" onChange={e => setSearch(e.target.value)} /></label><label className="admin-field admin-space-top">Client or partner<select disabled={saving || uncertain} value={selectedUser} onChange={e => choose(e.target.value, selectedProject)}><option value="">Select relationship…</option>{data.profiles.filter(p => p.id === selectedUser || matchesSearch(search, p.full_name, p.email)).map(p => <option key={p.id} value={p.id}>{p.full_name || p.email} · {p.role}{p.is_active ? "" : " · Inactive"}</option>)}</select></label><label className="admin-field admin-space-top">Project<select disabled={saving || uncertain} value={selectedProject} onChange={e => choose(selectedUser, e.target.value)}><option value="">Select project…</option>{data.projects.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}</select></label>
        {profile && <div className="admin-space-top"><span className="admin-status">{profile.is_active ? "Active" : "Inactive"} · {profile.role}</span><p className="admin-help">{profile.email}</p>{!profile.is_active && <p className="admin-help">This account is inactive. Saving permissions does not activate it.</p>}</div>}
      </aside>
      <div className="admin-panel">{profile && project ? <>
        <p className="eyebrow">Offering permissions</p><h2 className="admin-subtitle">{project.title}</h2><p className="admin-help">{project.location}</p>
        {!available.length && <p className="admin-empty">No active offerings are available.</p>}
        <fieldset className="admin-permissions" disabled={saving || uncertain || inactiveGrants.length > 0}><legend className="admin-help">Accessible opportunities</legend>{available.map(offering => <label className="admin-permission" key={offering.id}><input type="checkbox" checked={selected.includes(offering.id)} onChange={() => setSelected(ids => ids.includes(offering.id) ? ids.filter(id => id !== offering.id) : [...ids, offering.id])} /><span>{title(offering)}</span></label>)}</fieldset>
        {inactiveGrants.length > 0 && <p role="alert" className="admin-notice">This account has saved permissions for inactive offerings. Review those offering records before editing this selection; they will not be removed silently.</p>}
        <p className="admin-help">Deselecting every offering removes access to this project. New opportunities are never assigned automatically.</p>
        {dirty && <div className="admin-change-summary" role="status"><strong>Unsaved changes</strong><p>Add: {added.map(title).join(", ") || "None"}</p><p>Remove: {removed.map(title).join(", ") || "None"}</p></div>}
        <div className="admin-actions admin-space-top"><button className="admin-button admin-button-primary" disabled={saving || uncertain || !dirty || inactiveGrants.length > 0} onClick={() => void save()}>{saving ? "Saving…" : "Save access permissions"}</button>{dirty && <button className="admin-button" disabled={saving || uncertain} onClick={() => setSelected(initial)}>Undo selection changes</button>}</div>
      </> : <p className="admin-empty">Select a relationship and project to review access.</p>}
      {notice && <p className="admin-notice" role={uncertain ? "alert" : "status"}>{notice}</p>}</div>
    </div>
    {profile && <><div className="admin-section-heading"><div><p className="eyebrow">Saved permissions</p><h2>Current project access.</h2></div></div><div className="admin-project-grid">{data.projects.filter(p => grantedIds(data, profile.id, p.id).length > 0).map(p => <article className="admin-panel" key={p.id}><h3 className="admin-subtitle">{p.title}</h3><div className="admin-interests">{data.offerings.filter(o => grantedIds(data, profile.id, p.id).includes(o.id)).map(o => <span key={o.id}>{title(o)}{o.status === "active" ? "" : " · Inactive"}</span>)}</div><button className="admin-button admin-space-top" disabled={saving || uncertain} onClick={() => choose(profile.id, p.id)}>Review access →</button></article>)}</div><p className="admin-help">This overview shows saved permissions for active projects. An active account and active offering are also required for private access.</p></>}
  </section><footer className="admin-footer">Private. Independent. International.</footer></main>;
}
