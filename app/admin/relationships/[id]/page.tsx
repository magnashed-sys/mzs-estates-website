"use client";
import {useAdminI18n} from '../../../../lib/admin/i18n';

import CountrySelect from "../../../components/CountrySelect";
import PhoneInput from "../../../components/PhoneInput";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "../../../../lib/supabase/client";
import "../../admin.css";
import styles from "./relationship.module.css";
import DeleteRelationship from "../DeleteRelationship";

type Status = "loading" | "ready" | "denied" | "error";
type Relationship = {
  id: string; full_name: string; email: string; role: string;
  is_active: boolean; created_at: string;
};
type Contact = {
  user_id: string; phone: string | null; street_address: string | null;
  house_number: string | null; address_addition: string | null;
  postal_code: string | null; city: string | null;
  region: string | null; country: string | null;
};
type Company = {
  id: string; legal_name: string; trading_name: string | null;
  registration_number: string | null; country: string | null;
  relationship_type: string; relationship_notes: string | null;
  created_at: string; updated_at: string;
};
type Project = {
  id: string; title: string; location: string | null; status: string;
};
type Offering = {
  id: string; project_id: string; title: string | null;
  offering_type: string; status: string;
};
type ProjectGrant = { project_id: string; granted_at: string };
type OfferingGrant = { offering_id: string; granted_at: string };
type LinkedRequest = {
  id: string; company: string | null; country: string | null;
  interests: string[]; status: string; created_at: string;
  email_verified_at: string | null;
};
type Dossier = {
  person: Relationship; contact: Contact | null; companies: Company[];
  projects: Project[]; offerings: Offering[];
  projectGrants: ProjectGrant[]; offeringGrants: OfferingGrant[];
  requests: LinkedRequest[];
};
const STAGING_URL = "https://senonkpxdtlhyhrubicg.supabase.co";
const offeringNames: Record<string, string> = {
  sale: "Private Sale", investment: "Investment",
  financing: "Private Capital", rental: "Private Rental",
};
const relationshipNames: Record<string, string> = {
  owner: "Owner", co_owner: "Co-owner", shareholder: "Shareholder",
  director: "Director / manager", employee: "Employee",
  authorized_representative: "Authorized representative",
  advisor: "Advisor", other: "Other",
};
const date = (value: string, adminLocale = 'en-GB') => new Date(value).toLocaleDateString(adminLocale, {
  timeZone: "Europe/Madrid", day: "2-digit", month: "short", year: "numeric",
});
const filled = (value: string | null | undefined) => value?.trim() || "Not supplied";

export default function RelationshipDossierPage() {
 const {t:adminT,locale:adminLocale}=useAdminI18n();

  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = params.id;
  const [state, setState] = useState<Status>("loading");
  const [dossier, setDossier] = useState<Dossier | null>(null);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveNotice, setSaveNotice] = useState("");
  const [contactDraft, setContactDraft] = useState<Record<string,string>>({});
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
        throw new Error("This Preview is not linked to isolated MZS Staging. No records were loaded.");
      }
      if (!id || !/^[a-f0-9-]{36}$/i.test(id)) {
        throw new Error("Invalid relationship identifier.");
      }
      const supabase = createClient();
      const { data: auth, error: authError } = await supabase.auth.getUser();
      if (!current()) return;
      if (authError || !auth.user) { router.replace("/login"); return; }
      const { data: operator, error: operatorError } = await supabase
        .from("profiles").select("role,is_active").eq("id", auth.user.id).single();
      if (!current()) return;
      if (operatorError || operator?.role !== "admin" || operator.is_active !== true) {
        setState("denied"); return;
      }

      const results = await Promise.all([
        supabase.from("profiles")
          .select("id,full_name,email,role,is_active,created_at")
          .eq("id", id).single(),
        supabase.from("mzs_member_contact_details")
          .select("user_id,phone,street_address,house_number,address_addition,postal_code,city,region,country")
          .eq("user_id", id).maybeSingle(),
        supabase.from("mzs_member_companies")
          .select("id,legal_name,trading_name,registration_number,country,relationship_type,relationship_notes,created_at,updated_at", { count: "exact" })
          .eq("user_id", id).order("legal_name"),
        supabase.from("project_access")
          .select("project_id,granted_at", { count: "exact" }).eq("user_id", id),
        supabase.from("offering_access")
          .select("offering_id,granted_at", { count: "exact" }).eq("user_id", id),
        supabase.from("projects")
          .select("id,title,location,status", { count: "exact" }).order("title"),
        supabase.from("offerings")
          .select("id,project_id,title,offering_type,status", { count: "exact" }).order("title"),
        supabase.from("access_requests")
          .select("id,company,country,interests,status,created_at,email_verified_at", { count: "exact" })
          .eq("auth_user_id", id).order("created_at", { ascending: false }).limit(20),
      ]);
      if (!current()) return;
      if (results.some(result => result.error)) {
        throw new Error("Unable to retrieve the full relationship dossier.");
      }
      if (results.some(result => result.count != null &&
          result.count > (result.data ? (Array.isArray(result.data) ? result.data.length : 1) : 0))) {
        throw new Error("This dossier exceeds the safe record limit. Pagination is required.");
      }
      const person = results[0].data as Relationship | null;
      if (!person || !["client", "partner"].includes(person.role)) {
        throw new Error("Client or partner relationship not found.");
      }
      setDossier({
        person,
        contact: results[1].data as Contact | null,
        companies: (results[2].data || []) as Company[],
        projectGrants: (results[3].data || []) as ProjectGrant[],
        offeringGrants: (results[4].data || []) as OfferingGrant[],
        projects: (results[5].data || []) as Project[],
        offerings: (results[6].data || []) as Offering[],
        requests: (results[7].data || []) as LinkedRequest[],
      });
      setState("ready");
    } catch (cause) {
      if (current()) {
        setError(cause instanceof Error ? cause.message : "Unable to load relationship.");
        setState("error");
      }
    }
  }, [id, router]);

  useEffect(() => {
    mounted.current = true;
    void load();
    return () => { mounted.current = false; generation.current += 1; };
  }, [load]);

  function startEditing() {
    if (!dossier) return;
    setContactDraft({
      full_name: dossier.person.full_name || "",
      phone: dossier.contact?.phone || "",
      street_address: dossier.contact?.street_address || "",
      house_number: dossier.contact?.house_number || "",
      address_addition: dossier.contact?.address_addition || "",
      postal_code: dossier.contact?.postal_code || "",
      city: dossier.contact?.city || "",
      region: dossier.contact?.region || "",
      country: dossier.contact?.country || "",
    });
    setSaveNotice("");
    setEditing(true);
  }
  async function saveContact(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving || !dossier) return;
    setSaving(true); setSaveNotice("");
    try {
      const res = await fetch("/api/admin/member-contact", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: dossier.person.id, ...contactDraft }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Unable to save contact details.");
      setEditing(false);
      setSaveNotice("Contact details saved.");
      await load();
    } catch (cause) {
      setSaveNotice(cause instanceof Error ? cause.message : "Unable to save contact details.");
    } finally { setSaving(false); }
  }

  if (state !== "ready" || !dossier) {
    return <main className="admin-page"><div className="admin-message">
      <p className="eyebrow">{adminT("MZS Relationships")}</p>
      <h1>{state === "loading" ? adminT("Preparing relationship.") :
        state === "denied" ? adminT("Access restricted.") : adminT("Unable to load.")}</h1>
      <p role={state === "error" ? "alert" : "status"}>
        {state === "loading" ? adminT("Verifying administrator access and data permissions…") :
          state === "denied" ? adminT("Active administrator access is required.") : adminT(error)}
      </p>
      {state === "error" && <button className="admin-button" onClick={() => void load()}>{adminT("Try again")}</button>}
      <Link href="/admin?tab=relationships">{adminT("← Relationships")}</Link>
    </div></main>;
  }

  const { person, contact, companies, projects, offerings, projectGrants,
    offeringGrants, requests } = dossier;
  const offeringGrantIds = new Set(offeringGrants.map(grant => grant.offering_id));
  const attached = projects.filter(project =>
    projectGrants.some(grant => grant.project_id === project.id));
  const address = [
    [contact?.street_address, contact?.house_number, contact?.address_addition]
      .filter(Boolean).join(" "),
    [contact?.postal_code, contact?.city].filter(Boolean).join(" "),
    [contact?.region, contact?.country].filter(Boolean).join(", "),
  ].filter(Boolean).join(", ");
  const events = [
    { key: "created", label: "Account created", when: person.created_at },
    ...projectGrants.map(grant => ({
      key: "project-" + grant.project_id,
      label: "Project access granted · " +
        (projects.find(project => project.id === grant.project_id)?.title || "Project"),
      when: grant.granted_at,
    })),
    ...companies.map(company => ({
      key: "company-" + company.id,
      label: "Company relationship declared · " + company.legal_name,
      when: company.created_at,
    })),
  ].filter(event => !!event.when).sort((a, b) => b.when.localeCompare(a.when));
  const offeringCount = offerings.filter(offering => offeringGrantIds.has(offering.id)).length;

  return <main className="admin-page">
    <header className="admin-header">
      <Link className="admin-brand" href="/admin">{adminT("MZS GROUP")}</Link>
      <div className="admin-header-actions">
        <span>{adminT("Private relationship management")}</span>
        <Link className="admin-button" href="/admin?tab=relationships">{adminT("← All relationships")}</Link>
      </div>
    </header>
    <section className="admin-content">
      <div className={styles.topline}>
        <div>
          <p className="eyebrow">{adminT("Relationship 360° ·")} {adminT(person.role)}</p>
          <h1 className={styles.heading}>{person.full_name || adminT("Unnamed relationship")}</h1>
          <p className={styles.muted}>{person.email}</p>
        </div>
        <span className={styles.status}>{person.is_active ? adminT("Active account") : adminT("Inactive account")}</span>
      </div>
      <div className={styles.metrics}>
        <div><span>{adminT("Declared companies")}</span><strong>{companies.length}</strong></div>
        <div><span>{adminT("Assigned projects")}</span><strong>{attached.length}</strong></div>
        <div><span>{adminT("Assigned opportunities")}</span><strong>{offeringCount}</strong></div>
      </div>

      <div className={styles.twoColumns}>
        <section className={styles.panel}>
          <div className={styles.panelHeading}><h2>{adminT("Personal details.")}</h2><button type="button" className="admin-button" onClick={() => editing ? setEditing(false) : startEditing()}>{editing ? adminT("Cancel") : adminT("Edit contact details")}</button></div>
          {editing ? <form onSubmit={saveContact} style={{display:"grid",gap:12}}>
            {([["full_name","Full name"],["phone","Telephone"],["street_address","Street"],["house_number","House number"],["address_addition","Address addition"],["postal_code","Postal code"],["city","City"],["region","Region"],["country","Country"]] as const).map(([key,label]) => key==='phone'
              ? <PhoneInput key={key} label={adminT(label)} value={contactDraft.phone || ''} disabled={saving} onChange={value=>setContactDraft(d=>({...d,phone:value}))}/>
              : <label key={key} style={{display:"grid",gap:6}}>{adminT(label)}{key==='country'
                ? <CountrySelect value={contactDraft.country || ''} disabled={saving} onChange={value=>setContactDraft(d=>({...d,country:value}))}/>
                : <input className="admin-input" value={contactDraft[key] || ""} disabled={saving} maxLength={key === "full_name" || key === "street_address" ? 160 : key === "house_number" || key === "postal_code" ? 24 : key === "address_addition" ? 80 : 120} required={key === "full_name"} onChange={e => setContactDraft(d => ({...d,[key]:e.target.value}))} />}</label>)}
            <button type="submit" className="admin-button" disabled={saving}>{saving ? adminT("Saving...") : adminT("Save contact details")}</button>
          </form> : <div className={styles.fieldGrid}>
            <div><small>{adminT("Full name")}</small><p>{filled(person.full_name)}</p></div>
            <div><small>{adminT("Email address")}</small><p>{filled(person.email)}</p></div>
            <div><small>{adminT("Telephone")}</small><p>{filled(contact?.phone)}</p></div>
            <div><small>{adminT("Account type")}</small><p>{person.role === "partner" ? adminT("Partner") : adminT("Private Client")}</p></div>
            <div className={styles.wide}><small>{adminT("Postal address")}</small><p>{address || adminT("Not supplied")}</p></div>
            <div><small>{adminT("Member since")}</small><p>{date(person.created_at, adminLocale)}</p></div>
            <div><small>{adminT("Account status")}</small><p>{person.is_active ? adminT("Active") : adminT("Inactive")}</p></div>
          </div>}
          {saveNotice && <p role="status" className={styles.note}>{saveNotice}</p>}
          <p className={styles.note}>{adminT("Administrators can update contact details here. Email, account status and access permissions are managed separately.")}</p>
        </section>

        <section className={styles.panel}>
          <div className={styles.panelHeading}><h2>{adminT("Companies.")}</h2><span>{companies.length}  {adminT("declared")}</span></div>
          {companies.length === 0 ? <p className={styles.empty}>{adminT("No companies have been declared yet.")}</p> :
            <div className={styles.stack}>
              {companies.map(company => <article key={company.id} className={styles.subcard}>
                <h3>{company.legal_name}</h3>
                {company.trading_name && <p>{company.trading_name}</p>}
                <span className={styles.chip}>{relationshipNames[company.relationship_type] || company.relationship_type}</span>
                <p>{[company.country, company.registration_number].filter(Boolean).join(" · ") || adminT("No further details supplied")}</p>
                {company.relationship_notes && <p>{company.relationship_notes}</p>}
              </article>)}
            </div>}
          <p className={styles.note}>{adminT("Company affiliations are self-declared, not legally verified. They do not grant project access or visibility to other members.")}</p>
        </section>
      </div>

      <section className={styles.panel}>
        <div className={styles.panelHeading}><h2>{adminT("Relationship roles & contracts.")}</h2></div>
        <p className={styles.note}>{adminT("Extend this relationship with a tenant, owner, investor or partner role. Companies and rental contracts reuse this same client account.")}</p>
        <Link className="admin-button" href={`/admin/relationships?profile=${encodeURIComponent(person.id)}`}>{adminT("Manage relationship details & roles →")}</Link>{" "}
        <Link className="admin-button" href={`/admin/group/estates/contracts?profile=${encodeURIComponent(person.id)}`}>{adminT("View rental contracts →")}</Link>
        <p><DeleteRelationship kind="account" id={person.id} onDeleted={()=>router.replace("/admin/relationships")}/></p>
      </section>

      <section className={styles.panel}>
        <div className={styles.panelHeading}><h2>{adminT("Project access.")}</h2><span>{attached.length}  {adminT("projects")}</span></div>
        {attached.length === 0 ? <p className={styles.empty}>{adminT("No project access assigned to this relationship.")}</p> :
          <div className={styles.projectList}>
            {attached.map(project => {
              const grant = projectGrants.find(item => item.project_id === project.id);
              const assigned = offerings.filter(offering =>
                offering.project_id === project.id && offeringGrantIds.has(offering.id));
              return <article key={project.id} className={styles.projectCard}>
                <div>
                  <span className={styles.kicker}>{adminT(project.status)} · {date(grant?.granted_at || person.created_at, adminLocale)}</span>
                  <h3>{project.title}</h3>
                  <p>{project.location || adminT("Private collection")}</p>
                  <div className={styles.tags}>
                    {assigned.map(offering => <span className={styles.chip} key={offering.id}>
                      {offeringNames[offering.offering_type] || offering.offering_type}
                      {offering.status !== "active" ? " · " + offering.status : ""}
                    </span>)}
                    {assigned.length === 0 && <span className={styles.note}>{adminT("No offering access currently assigned.")}</span>}
                  </div>
                </div>
                <Link className="admin-button" href={
                  "/admin/project-access?user=" + encodeURIComponent(person.id) +
                  "&project=" + encodeURIComponent(project.id)
                }>{adminT("Manage access →")}</Link>
              </article>;
            })}
          </div>}
        <p className={styles.note}>{adminT("Saved access differs from actual visibility: the account, project and offering must also be active. Access changes still use the existing verified permission workflow.")}</p>
      </section>

      <div className={styles.twoColumns}>
        <section className={styles.panel}>
          <div className={styles.panelHeading}><h2>{adminT("Account applications.")}</h2><span>{requests.length}  {adminT("linked")}</span></div>
          {requests.length === 0 ? <p className={styles.empty}>{adminT("No application is directly linked to this account.")}</p> :
            <div className={styles.stack}>
              {requests.map(request => <div className={styles.subcard} key={request.id}>
                <span className={styles.kicker}>{date(request.created_at, adminLocale)} · {adminT(request.status)}</span>
                <p>{[request.company, request.country].filter(Boolean).join(" · ") || adminT("Private access request")}</p>
                <div className={styles.tags}>{(request.interests || []).map(interest =>
                  <span className={styles.chip} key={interest}>{offeringNames[interest] || interest}</span>)}</div>
              </div>)}
            </div>}
        </section>

        <section className={styles.panel}>
          <div className={styles.panelHeading}><h2>{adminT("Recorded milestones.")}</h2><span>{events.length}  {adminT("records")}</span></div>
          <div className={styles.timeline}>
            {events.slice(0, 12).map(event => <div key={event.key} className={styles.event}>
              <span>{date(event.when, adminLocale)}</span><p>{adminT(event.label)}</p>
            </div>)}
          </div>
          <p className={styles.note}>{adminT("Only recorded account, company and access milestones appear here. Logins, page views and communications are not yet tracked in this dossier.")}</p>
        </section>
      </div>
    </section>
    <footer className="admin-footer">{adminT("Private. Independent. International.")}</footer>
  </main>;
}
