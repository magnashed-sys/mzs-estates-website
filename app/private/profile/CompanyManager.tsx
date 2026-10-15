"use client";

import { useEffect, useState, type FormEvent } from "react";
import { createClient } from "../../../lib/supabase/client";
import styles from "./profile.module.css";

type Relationship = "owner" | "co_owner" | "shareholder" | "director" |
  "employee" | "authorized_representative" | "advisor" | "other";
type Company = {
  id: string; user_id: string; legal_name: string; trading_name: string | null;
  registration_number: string | null; country: string | null;
  relationship_type: Relationship; relationship_notes: string | null; created_at: string;
};
type Draft = {
  legal_name: string; trading_name: string; registration_number: string;
  country: string; relationship_type: Relationship; relationship_notes: string;
};
const options: { value: Relationship; label: string }[] = [
  { value: "owner", label: "Owner" },
  { value: "co_owner", label: "Co-owner" },
  { value: "shareholder", label: "Shareholder" },
  { value: "director", label: "Director / manager" },
  { value: "employee", label: "Employee" },
  { value: "authorized_representative", label: "Authorised representative" },
  { value: "advisor", label: "Advisor" },
  { value: "other", label: "Other relationship" },
];
const initial = (): Draft => ({
  legal_name: "", trading_name: "", registration_number: "", country: "",
  relationship_type: "owner", relationship_notes: "",
});
const display = (value: string | null) => value?.trim() || "";
const labelOf = (value: Relationship) => options.find(x => x.value === value)?.label || "Other";

export default function CompanyManager({ userId }: { userId: string }) {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [draft, setDraft] = useState<Draft>(initial);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  function change<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft(current => ({ ...current, [key]: value }));
  }
  async function refresh() {
    const { data, error: failure } = await createClient()
      .from("mzs_member_companies")
      .select("id,user_id,legal_name,trading_name,registration_number,country,relationship_type,relationship_notes,created_at")
      .eq("user_id", userId).order("created_at", { ascending: false });
    if (failure) throw failure;
    setCompanies((data || []) as Company[]);
  }
  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const { data, error: failure } = await createClient()
          .from("mzs_member_companies")
          .select("id,user_id,legal_name,trading_name,registration_number,country,relationship_type,relationship_notes,created_at")
          .eq("user_id", userId).order("created_at", { ascending: false });
        if (failure) throw failure;
        if (mounted) setCompanies((data || []) as Company[]);
      } catch {
        if (mounted) setError("Unable to load your business relationships.");
      } finally {
        if (mounted) setLoading(false);
      }
    }
    void load();
    return () => { mounted = false; };
  }, [userId]);

  function start(company?: Company) {
    if (saving) return;
    setNotice(""); setError("");
    setEditing(company?.id ?? null);
    setDraft(company ? {
      legal_name: company.legal_name, trading_name: display(company.trading_name),
      registration_number: display(company.registration_number), country: display(company.country),
      relationship_type: company.relationship_type, relationship_notes: display(company.relationship_notes),
    } : initial());
    setShowForm(true);
  }
  function cancel() {
    if (saving) return;
    setEditing(null); setDraft(initial()); setShowForm(false); setError("");
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    setNotice(""); setError("");
    const name = draft.legal_name.trim().replace(/\s+/g, " ");
    if (name.length < 2 || name.length > 180) {
      setError("Enter a legal company name between 2 and 180 characters.");
      return;
    }
    const fields = {
      legal_name: name, trading_name: draft.trading_name.trim() || null,
      registration_number: draft.registration_number.trim() || null,
      country: draft.country.trim() || null, relationship_type: draft.relationship_type,
      relationship_notes: draft.relationship_notes.trim() || null,
      updated_at: new Date().toISOString(),
    };
    setSaving(true);
    try {
      const client = createClient();
      if (editing) {
        const { data, error: failure } = await client.from("mzs_member_companies")
          .update(fields).eq("id", editing).eq("user_id", userId).select("id").single();
        if (failure || !data) throw new Error("Update unconfirmed");
      } else {
        const { data, error: failure } = await client.from("mzs_member_companies")
          .insert({ ...fields, user_id: userId }).select("id").single();
        if (failure || !data) throw new Error("Creation unconfirmed");
      }
      await refresh();
      setNotice(editing ? "Company details updated." : "Company added to your profile.");
      setShowForm(false); setEditing(null); setDraft(initial());
    } catch {
      setError("Unable to confirm this change. Refresh before trying again.");
    } finally {
      setSaving(false);
    }
  }

  async function remove(company: Company) {
    if (saving) return;
    if (!window.confirm("Remove " + company.legal_name +
      " from your listed businesses? This will not affect project access.")) return;
    setError(""); setNotice(""); setSaving(true);
    try {
      const { data, error: failure } = await createClient().from("mzs_member_companies")
        .delete().eq("id", company.id).eq("user_id", userId).select("id").single();
      if (failure || !data) throw new Error("Removal unconfirmed");
      await refresh();
      if (editing === company.id) {
        setEditing(null); setShowForm(false); setDraft(initial());
      }
      setNotice("The company has been removed from your profile.");
    } catch {
      setError("The removal was not confirmed. Refresh before retrying.");
    } finally {
      setSaving(false);
    }
  }

  return <section className={styles.panel} aria-label="My companies">
    <div className={styles.panelHead}>
      <div>
        <p className={styles.kicker}>BUSINESS RELATIONSHIPS</p>
        <h2 className={styles.panelTitle}>My Companies.</h2>
        <p className={styles.panelDescription}>Register multiple companies and describe
          your personal role in each one. You can revise or remove these details.</p>
      </div>
      {!showForm && <button className={styles.primary} type="button"
        disabled={saving || loading} onClick={() => start()}>+ Add Company</button>}
    </div>
    <p className={styles.note}>These company connections are self-declared.
      Adding a company or choosing &ldquo;Owner&rdquo; does not verify ownership,
      give anyone access to MZS projects, or create accounts for employees.</p>
    {notice && <p className={styles.success} role="status">{notice}</p>}
    {error && <p className={styles.error} role="alert">{error}</p>}
    {loading ? <p className={styles.empty} role="status">Loading businesses…</p>
      : companies.length ? <div className={styles.companyCards} style={{ marginTop: 25 }}>
        {companies.map(company => <article key={company.id} className={styles.companyCard}>
          <h3 className={styles.companyName}>{company.legal_name}</h3>
          {company.trading_name && company.trading_name !== company.legal_name &&
            <p className={styles.companyMeta}>Trading as {company.trading_name}</p>}
          {company.country && <p className={styles.companyMeta}>Country: {company.country}</p>}
          {company.registration_number &&
            <p className={styles.companyMeta}>Registration: {company.registration_number}</p>}
          <span className={styles.rolePill}>{labelOf(company.relationship_type)}</span>
          {company.relationship_notes &&
            <p className={styles.companyMeta}>{company.relationship_notes}</p>}
          <div className={styles.companyActions}>
            <button className={styles.secondary} type="button" disabled={saving}
              onClick={() => start(company)}>Edit</button>
            <button className={styles.danger} type="button" disabled={saving}
              onClick={() => void remove(company)}>Remove</button>
          </div>
        </article>)}
      </div> : <p className={styles.empty} style={{ marginTop: 22 }}>
        No companies added yet. Select <strong>Add Company</strong> to begin.
      </p>}

    {showForm && <form className={styles.form} onSubmit={save} aria-busy={saving}
      style={{ marginTop: 30, paddingTop: 25, borderTop: "1px solid rgba(213,192,154,.24)" }}>
      <div>
        <p className={styles.kicker}>{editing ? "EDIT RELATIONSHIP" : "NEW BUSINESS"}</p>
        <h3 className={styles.panelTitle}>{editing ? "Update company." : "Add a company."}</h3>
      </div>
      <div className={styles.grid}>
        <label className={styles.field}>Legal company name *
          <input value={draft.legal_name} maxLength={180} minLength={2} required
            disabled={saving} autoComplete="organization"
            onChange={e => change("legal_name", e.target.value)} />
        </label>
        <label className={styles.field}>Your relationship *
          <select value={draft.relationship_type} required disabled={saving}
            onChange={e => change("relationship_type", e.target.value as Relationship)}>
            {options.map(option =>
              <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </label>
        <label className={styles.field}>Trading name
          <input value={draft.trading_name} maxLength={180} disabled={saving}
            onChange={e => change("trading_name", e.target.value)} />
        </label>
        <label className={styles.field}>Registration number
          <input value={draft.registration_number} maxLength={100} disabled={saving}
            onChange={e => change("registration_number", e.target.value)} />
        </label>
        <label className={styles.field}>Country of registration
          <input value={draft.country} maxLength={120} disabled={saving}
            onChange={e => change("country", e.target.value)} />
        </label>
        <label className={styles.field + " " + styles.fieldFull}>
          Additional details about your role
          <textarea value={draft.relationship_notes} maxLength={1000} disabled={saving}
            onChange={e => change("relationship_notes", e.target.value)}
            placeholder="For example: managing director and minority shareholder" />
        </label>
      </div>
      <div className={styles.actions}>
        <button className={styles.primary} type="submit" disabled={saving}>
          {saving ? "Saving…" : editing ? "Save Changes →" : "Add Company →"}
        </button>
        <button className={styles.secondary} type="button" disabled={saving}
          onClick={cancel}>Cancel</button>
      </div>
    </form>}
  </section>;
}
