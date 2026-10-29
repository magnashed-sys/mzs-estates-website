"use client";
import {useAdminI18n} from '../../../../lib/admin/i18n';


import { useState, type FormEvent } from "react";
import { createClient } from "../../../../lib/supabase/client";
import type { Offering } from "./project-model";
import { offeringNames } from "./project-model";
import styles from "./projectCockpit.module.css";

type Props = {
  projectId: string;
  offerings: Offering[];
  grantCounts: Record<string, number>;
  onReload: () => Promise<void>;
};
const types: Offering["offering_type"][] = ["investment", "sale", "rental", "financing"];

function OfferingEditor({ offering, grantCount, onReload }: {
  offering: Offering; grantCount: number; onReload: () => Promise<void>;
}) {
 const {t:adminT,locale:adminLocale}=useAdminI18n();

  const [title, setTitle] = useState(offering.title || "");
  const [summary, setSummary] = useState(offering.summary || "");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    if (title.trim().length < 3 || title.trim().length > 150 || summary.length > 2500) {
      setError("Enter a title of 3–150 characters and a summary of up to 2,500 characters.");
      return;
    }
    setBusy(true); setError(""); setNotice("");
    try {
      const { data, error: failure } = await createClient()
        .from("offerings")
        .update({ title: title.trim(), summary: summary.trim() || null, updated_at: new Date().toISOString() })
        .eq("id", offering.id).eq("project_id", offering.project_id)
        .eq("updated_at", offering.updated_at)
        .select("id").maybeSingle();
      if (failure || !data) throw new Error("This offering changed in another session. Refresh before editing again.");
      await onReload();
      setNotice("Offering details saved.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to save offering.");
    } finally { setBusy(false); }
  }

  async function changePublished() {
    if (busy || offering.status === "archived") return;
    const activating = offering.status !== "active";
    if (!activating && grantCount > 0) {
      setError("This offering has assigned members. Review their access before deactivating it.");
      return;
    }
    const next = activating ? "active" : "draft";
    if (!window.confirm(activating
      ? adminT("Activate this offering? Existing assigned members can see it; other members get no automatic access.")
      : adminT("Move this offering back to draft? It will no longer be visible to clients."))) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const { data, error: failure } = await createClient().from("offerings")
        .update({ status: next, updated_at: new Date().toISOString() })
        .eq("id", offering.id).eq("project_id", offering.project_id)
        .eq("updated_at", offering.updated_at).select("id,status").maybeSingle();
      if (failure || !data || data.status !== next) {
        throw new Error("Could not confirm the new offering status. Refresh before retrying.");
      }
      await onReload();
      setNotice("Offering status updated.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Status change was not confirmed.");
    } finally { setBusy(false); }
  }

  return <article className={styles.item}>
    <div className={styles.itemHeading}>
      <div><span className={styles.kicker}>{offeringNames[offering.offering_type]}</span>
        <h3>{offering.title || offeringNames[offering.offering_type]}</h3></div>
      <span className={styles.pill}>{adminT(offering.status)}</span>
    </div>
    <p className={styles.muted}>{grantCount}  {adminT("explicit offering grant")}{grantCount === 1 ? "" : adminT("s")}  {adminT("· Does not auto-assign access")}</p>
    <form onSubmit={save} className={styles.form}>
      <label>{adminT("Offering title")}<input value={title} onChange={e => setTitle(e.target.value)} maxLength={150} required disabled={busy} />
      </label>
      <label>{adminT("Summary")}<textarea rows={3} value={summary} maxLength={2500} onChange={e => setSummary(e.target.value)} disabled={busy} />
      </label>
      <div className={styles.actions}>
        <button className="admin-button admin-button-primary" disabled={busy} type="submit">{busy ? adminT("Saving…") : adminT("Save offering")}</button>
        {offering.status !== "archived" && <button className="admin-button" disabled={busy || (offering.status === "active" && grantCount > 0)} type="button" onClick={()=>void changePublished()}>
          {offering.status === "active" ? adminT("Move to draft") : adminT("Activate offering")}
        </button>}
      </div>
    </form>
    {notice && <p className={styles.success} role="status">{adminT(notice)}</p>}
    {error && <p className={styles.failure} role="alert">{adminT(error)}</p>}
  </article>;
}

export default function OfferingManager({ projectId, offerings, grantCounts, onReload }: Props) {
 const {t:adminT,locale:adminLocale}=useAdminI18n();

  const unused = types.filter(type => !offerings.some(o => o.offering_type === type));
  const [kind, setKind] = useState<Offering["offering_type"]>("investment");
  const [newTitle, setNewTitle] = useState("");
  const [newSummary, setNewSummary] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (creating) return;
    const offeredType = unused.includes(kind) ? kind : unused[0];
    if (!offeredType || newTitle.trim().length < 3 || newTitle.trim().length > 150 ||
        newSummary.length > 2500) {
      setError("Select an unused offering type and provide a valid title and summary.");
      return;
    }
    if (!window.confirm(adminT("Create a NEW DRAFT offering? No client access is granted, and it will not be published automatically."))) return;
    setCreating(true); setError("");
    try {
      const { error: failure } = await createClient().from("offerings")
        .insert({ project_id: projectId, offering_type: offeredType,
          title: newTitle.trim(), summary: newSummary.trim() || null,
          status: "draft" });
      if (failure) throw failure;
      setNewTitle(""); setNewSummary("");
      await onReload();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to create draft offering.");
    } finally { setCreating(false); }
  }

  return <div className={styles.stack}>
    <p className={styles.note}>{adminT("Offerings are separate sale, rental, investment or financing opportunities. Saving content never changes existing project rights. New offerings start as private drafts.")}</p>
    {offerings.map(offering =>
      <OfferingEditor key={offering.id + offering.updated_at} offering={offering}
        grantCount={grantCounts[offering.id] || 0} onReload={onReload} />)}
    {unused.length > 0 && <section className={styles.panel}>
      <h2>{adminT("Create a draft offering.")}</h2>
      <form className={styles.form} onSubmit={create}>
        <label>{adminT("Type")}<select value={unused.includes(kind) ? kind : unused[0]} onChange={e => setKind(e.target.value as Offering["offering_type"])} disabled={creating}>
            {unused.map(type => <option key={type} value={type}>{offeringNames[type]}</option>)}
          </select>
        </label>
        <label>{adminT("Offering title")}<input value={newTitle} required maxLength={150} onChange={e=>setNewTitle(e.target.value)} disabled={creating} />
        </label>
        <label>{adminT("Summary")}<textarea rows={3} maxLength={2500} value={newSummary} onChange={e=>setNewSummary(e.target.value)} disabled={creating} />
        </label>
        <button className="admin-button admin-button-primary" type="submit" disabled={creating}>{creating ? adminT("Creating…") : adminT("Create draft offering")}</button>
        {error && <p className={styles.failure} role="alert">{adminT(error)}</p>}
      </form>
    </section>}
    {!unused.length && <p className={styles.note}>{adminT("All four offering types are already represented for this project.")}</p>}
  </div>;
}
