"use client";
import {useAdminI18n} from '../../../../lib/admin/i18n';


import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "../../../../lib/supabase/client";
import "../../admin.css";
import OfferingManager from "./OfferingManager";
import ContentManager from "./ContentManager";
import DocumentManager from "./DocumentManager";
import type { CockpitData, Project, Offering, TextBlock, ProjectDocument, Member, ProjectGrant, OfferingGrant } from "./project-model";
import { STAGING_URL, offeringNames } from "./project-model";
import styles from "./projectCockpit.module.css";

type Tab = "overview" | "offerings" | "content" | "documents" | "access";
type Status = "loading" | "ready" | "denied" | "error";
const nav: [Tab, string][] = [
  ["overview", "Overview & details"],
  ["offerings", "Offerings"],
  ["content", "Project content"],
  ["documents", "Documents"],
  ["access", "Client access"],
];
const date = (value: string, adminLocale = 'en-GB') => new Date(value).toLocaleDateString(adminLocale, {
  day: "2-digit", month: "short", year: "numeric", timeZone: "Europe/Madrid",
});

export default function ProjectCockpitPage() {
 const {t:adminT,locale:adminLocale}=useAdminI18n();

  const router = useRouter();
  const params = useParams<{ id: string }>();
  const projectId = params.id;
  const [state, setState] = useState<Status>("loading");
  const [data, setData] = useState<CockpitData | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState<Tab>("overview");
  const [projectTitle, setProjectTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [location, setLocation] = useState("");
  const [heroImage, setHeroImage] = useState("");
  const mounted = useRef(false);
  const generation = useRef(0);

  const load = useCallback(async () => {
    const version = ++generation.current;
    const current = () => mounted.current && generation.current === version;
    setState("loading"); setError("");
    try {
      const hostname = window.location.hostname;
      if (hostname.startsWith("mzs-group-") &&
          hostname.endsWith("-mzs3.vercel.app") &&
          process.env.NEXT_PUBLIC_SUPABASE_URL !== STAGING_URL) {
        throw new Error("This Preview is not isolated to MZS Staging. No data loaded.");
      }
      if (!/^[a-f0-9-]{36}$/i.test(projectId || "")) {
        throw new Error("Invalid project identifier.");
      }
      const supabase = createClient();
      const { data: auth, error: authError } = await supabase.auth.getUser();
      if (!current()) return;
      if (authError || !auth.user) { router.replace("/login"); return; }
      const { data: operator, error: operatorError } = await supabase.from("profiles")
        .select("role,is_active").eq("id", auth.user.id).single();
      if (!current()) return;
      if (operatorError || operator?.role !== "admin" || operator.is_active !== true) {
        setState("denied"); return;
      }
      // All data is protected by authenticated Supabase RLS. Fail closed for
      // missing permissions, partial results, and missing document migration.
      const results = await Promise.all([
        supabase.from("projects")
          .select("id,slug,title,subtitle,location,hero_image_url,status,created_at,updated_at")
          .eq("id", projectId).single(),
        supabase.from("offerings")
          .select("id,project_id,offering_type,title,summary,status,created_at,updated_at", { count: "exact" })
          .eq("project_id", projectId).order("offering_type"),
        supabase.from("project_content")
          .select("id,project_id,block_type,content,position,is_visible,updated_at", { count: "exact" })
          .eq("project_id", projectId).order("position"),
        supabase.from("mzs_project_documents")
          .select("id,project_id,offering_id,file_path,title,description,category,mime_type,file_size_bytes,is_published,position,created_at", { count: "exact" })
          .eq("project_id", projectId).order("position").order("created_at"),
        supabase.from("project_access")
          .select("user_id,project_id,granted_at", { count: "exact" })
          .eq("project_id", projectId),
        supabase.from("offering_access")
          .select("user_id,offering_id,granted_at", { count: "exact" }),
        supabase.from("profiles")
          .select("id,full_name,email,role,is_active", { count: "exact" })
          .in("role", ["client", "partner"]).order("full_name"),
      ]);
      if (!current()) return;
      if (results.some(result => result.error)) throw new Error("The full project dossier could not be loaded. Confirm Staging database migration and administrator permissions.");
      if (results.some(result => result.count != null &&
          result.count > (Array.isArray(result.data) ? result.data.length : 0))) {
        throw new Error("More project records exist than the safe query limit. Server pagination is needed.");
      }
      const project = results[0].data as Project | null;
      if (!project) throw new Error("Project not found.");
      const offerings = (results[1].data || []) as Offering[];
      const ids = new Set(offerings.map(item=>item.id));
      const next: CockpitData = {
        project,
        offerings,
        blocks: ((results[2].data || []) as TextBlock[]).filter(block=>block.block_type === "text"),
        documents: (results[3].data || []) as ProjectDocument[],
        projectGrants: (results[4].data || []) as ProjectGrant[],
        offeringGrants: ((results[5].data || []) as OfferingGrant[]).filter(grant=>ids.has(grant.offering_id)),
        members: (results[6].data || []) as Member[],
      };
      setData(next); setProjectTitle(project.title);
      setSubtitle(project.subtitle || ""); setLocation(project.location || "");
      setHeroImage(project.hero_image_url || "");
      setState("ready");
    } catch (cause) {
      if (current()) {
        setError(cause instanceof Error ? cause.message : "Unable to load Project Cockpit.");
        setState("error");
      }
    }
  }, [projectId, router]);

  useEffect(() => {
    mounted.current = true;
    void load();
    return () => { mounted.current = false; generation.current += 1; };
  }, [load]);

  async function saveProject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!data || saving) return;
    if (projectTitle.trim().length < 3 || projectTitle.trim().length > 160 ||
        subtitle.length > 250 || location.length > 250 ||
        (heroImage && (!heroImage.startsWith("/properties/") ||
          heroImage.includes("..") || heroImage.includes("?") ||
          !/^\/properties\/[a-zA-Z0-9_./-]+$/.test(heroImage)))) {
      setError("Enter a valid project title and optional fields. Image paths must be local /properties/ assets.");
      return;
    }
    const changed = projectTitle.trim() !== data.project.title ||
      (subtitle.trim() || null) !== data.project.subtitle ||
      (location.trim() || null) !== data.project.location ||
      (heroImage.trim() || null) !== data.project.hero_image_url;
    if (!changed) { setNotice("No changes to save."); return; }
    if (!window.confirm(adminT("Update project metadata? For ACTIVE projects, title, subtitle, location and the private dashboard image may change immediately for authorized clients. The existing custom project presentation remains intact."))) return;
    setSaving(true); setError(""); setNotice("");
    try {
      const { data: result, error: failure } = await createClient().from("projects")
        .update({ title: projectTitle.trim(), subtitle: subtitle.trim() || null,
          location: location.trim() || null, hero_image_url: heroImage.trim() || null,
          updated_at: new Date().toISOString() })
        .eq("id", data.project.id).eq("updated_at", data.project.updated_at)
        .select("id").maybeSingle();
      if (failure || !result) throw new Error("This project may have been changed by someone else. Refresh before retrying.");
      await load();
      setNotice("Project metadata saved and verified.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to save project.");
    } finally { setSaving(false); }
  }

  if (state !== "ready" || !data) {
    return <main className="admin-page"><div className="admin-message">
      <p className="eyebrow">{adminT("MZS Project Cockpit")}</p>
      <h1>{state === "denied" ? adminT("Access restricted.") : state === "error" ? adminT("Unable to load.") : adminT("Preparing project.")}</h1>
      <p role={state === "error" ? "alert" : "status"}>{state === "error" ? adminT(error) :
        state === "denied" ? adminT("Active administrator access is required.") : adminT("Verifying project access…")}</p>
      {state === "error" && <button type="button" className="admin-button" onClick={()=>void load()}>{adminT("Try again")}</button>}
      <Link href="/admin?tab=projects">{adminT("← Back to projects")}</Link>
    </div></main>;
  }

  const { project, offerings, blocks, documents, members, projectGrants, offeringGrants } = data;
  const grantsByOffering: Record<string, number> = {};
  for (const grant of offeringGrants) {
    grantsByOffering[grant.offering_id] = (grantsByOffering[grant.offering_id] || 0) + 1;
  }
  const assignedIds = new Set(projectGrants.map(grant=>grant.user_id));
  const membersAssigned = members.filter(member=>assignedIds.has(member.id));
  const publishedTexts = blocks.filter(block=>block.is_visible).length;
  const publishedDocs = documents.filter(doc=>doc.is_published).length;
  const allOfferingIds = new Set(offerings.map(offering=>offering.id));
  const includedGrants = offeringGrants.filter(grant=>allOfferingIds.has(grant.offering_id));

  return <main className="admin-page">
    <header className="admin-header">
      <Link href="/admin" className="admin-brand">{adminT("MZS GROUP")}</Link>
      <div className="admin-header-actions">
        <span>{adminT("Private Project Management")}</span>
        <Link href="/admin?tab=projects" className="admin-button">{adminT("← All projects")}</Link>
      </div>
    </header>
    <section className="admin-content">
      <div className={styles.hero}>
        <div><p className="eyebrow">{adminT("Project Cockpit ·")} {adminT(project.status)}</p>
          <h1>{project.title}</h1>
          <p className={styles.muted}>{project.location || adminT("Private collection")} · {project.slug}</p>
        </div>
        <div className={styles.heroActions}>
          <button className="admin-button" disabled={saving} onClick={()=>void load()}>{adminT("Refresh project")}</button>
          <Link href={"/admin/project-access?project=" + encodeURIComponent(project.id)} className="admin-button admin-button-primary">{adminT("Manage client access →")}</Link>
        </div>
      </div>
      <div className={styles.metrics}>
        <div><span>{adminT("Offerings")}</span><strong>{offerings.length}</strong></div>
        <div><span>{adminT("Assigned members")}</span><strong>{membersAssigned.length}</strong></div>
        <div><span>{adminT("Published text")}</span><strong>{publishedTexts}</strong></div>
        <div><span>{adminT("Published documents")}</span><strong>{publishedDocs}</strong></div>
      </div>
      <nav className={styles.nav} aria-label={adminT("Project administration sections")}>
        {nav.map(([id,label])=><button key={id} type="button" disabled={saving}
          aria-current={tab===id?"page":undefined} onClick={()=>{setTab(id);setNotice("");setError("");}}>{adminT(label)}</button>)}
      </nav>

      {tab==="overview" && <div className={styles.stack}>
        <section className={styles.panel}>
          <div className={styles.panelTitle}><h2>{adminT("Project details.")}</h2><span>{adminT("Private collection")}</span></div>
          <p className={styles.note}>{adminT("Update the catalog name, subtitle, location and client-dashboard image. Slugs, project status, rental calendars and bespoke presentation layouts are intentionally protected in this first release.")}</p>
          <form className={styles.form} onSubmit={saveProject}>
            <label>{adminT("Project title")}<input required value={projectTitle} maxLength={160} onChange={e=>setProjectTitle(e.target.value)} disabled={saving} />
            </label>
            <label>{adminT("Subtitle")}<input value={subtitle} maxLength={250} onChange={e=>setSubtitle(e.target.value)} disabled={saving} />
            </label>
            <label>{adminT("Location")}<input value={location} maxLength={250} onChange={e=>setLocation(e.target.value)} disabled={saving} />
            </label>
            <label>{adminT("Private dashboard hero image — site-local /properties/ path")}<input value={heroImage} placeholder={adminT("/properties/example/hero.webp")} onChange={e=>setHeroImage(e.target.value)} disabled={saving} />
            </label>
            <div className={styles.actions}>
              <button type="submit" className="admin-button admin-button-primary" disabled={saving}>{saving ? adminT("Saving…") : adminT("Save project details")}</button>
              <Link className="admin-button" href={"/admin/project-access?project=" + encodeURIComponent(project.id)}>{adminT("Manage permissions →")}</Link>
            </div>
          </form>
          <p className={styles.note}>{adminT("Project created")} {date(project.created_at, adminLocale)}  {adminT("· Status")} {adminT(project.status)}  {adminT("· Changes to catalog details take effect immediately once saved.")}</p>
        </section>
        <div className={styles.summaryColumns}>
          <section className={styles.panel}>
            <h2>{adminT("Available offerings.")}</h2>
            {offerings.map(offering=><div key={offering.id} className={styles.summaryRow}>
              <div><strong>{offeringNames[offering.offering_type]}</strong><small>{offering.title || adminT("Untitled")}</small></div>
              <span className={styles.pill}>{adminT(offering.status)}</span>
            </div>)}
            <button type="button" className="admin-button" onClick={()=>setTab("offerings")}>{adminT("Manage offerings →")}</button>
          </section>
          <section className={styles.panel}>
            <h2>{adminT("Private materials.")}</h2>
            <div className={styles.summaryRow}><span>{adminT("Text blocks")}</span><strong>{blocks.length}  {adminT("total ·")} {publishedTexts}  {adminT("published")}</strong></div>
            <div className={styles.summaryRow}><span>{adminT("Documents")}</span><strong>{documents.length}  {adminT("total ·")} {publishedDocs}  {adminT("published")}</strong></div>
            <div className={styles.actions}>
              <button type="button" className="admin-button" onClick={()=>setTab("content")}>{adminT("Edit text →")}</button>
              <button type="button" className="admin-button" onClick={()=>setTab("documents")}>{adminT("Manage documents →")}</button>
            </div>
          </section>
        </div>
      </div>}

      {tab==="offerings" && <OfferingManager projectId={project.id} offerings={offerings}
        grantCounts={grantsByOffering} onReload={load} />}
      {tab==="content" && <ContentManager projectId={project.id} blocks={blocks}
        onReload={load} />}
      {tab==="documents" && <DocumentManager projectId={project.id} offerings={offerings}
        documents={documents} onReload={load} />}
      {tab==="access" && <section className={styles.panel}>
        <div className={styles.panelTitle}><h2>{adminT("Assigned relationships.")}</h2><span>{membersAssigned.length}  {adminT("members")}</span></div>
        <p className={styles.note}>{adminT("Offering grants are never inherited from project access. Review each member's explicit permissions via the existing verified access editor. The Project Cockpit does not change account permissions automatically.")}</p>
        {membersAssigned.length===0 ? <p className={styles.empty}>{adminT("No clients or partners have been assigned to this project.")}</p> :
          <div className={styles.stack}>
            {membersAssigned.map(member=>{
              const ids = new Set(includedGrants.filter(g=>g.user_id===member.id).map(g=>g.offering_id));
              const memberOffers = offerings.filter(o=>ids.has(o.id));
              return <article key={member.id} className={styles.item}>
                <div className={styles.itemHeading}>
                  <div><h3>{member.full_name || member.email}</h3><p className={styles.muted}>{member.email}</p></div>
                  <span className={styles.pill}>{member.is_active ? adminT("Active") : adminT("Inactive")}</span>
                </div>
                <div className={styles.chips}>
                  {memberOffers.map(offering=><span className={styles.pill} key={offering.id}>
                    {offeringNames[offering.offering_type]} · {adminT(offering.status)}
                  </span>)}
                  {!memberOffers.length && <span className={styles.note}>{adminT("No offering grant.")}</span>}
                </div>
                <div className={styles.actions}>
                  <Link className="admin-button" href={"/admin/relationships/" + encodeURIComponent(member.id)}>{adminT("Relationship dossier →")}</Link>
                  <Link className="admin-button" href={"/admin/project-access?user=" + encodeURIComponent(member.id) + "&project=" + encodeURIComponent(project.id)}>{adminT("Review access →")}</Link>
                </div>
              </article>;
            })}
          </div>}
      </section>}
      {notice && <p className={styles.success} role="status">{adminT(notice)}</p>}
      {error && <p className={styles.failure} role="alert">{adminT(error)}</p>}
    </section>
    <footer className="admin-footer">{adminT("Private. Independent. International.")}</footer>
  </main>;
}
