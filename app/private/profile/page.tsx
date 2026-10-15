"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "../../../lib/supabase/client";
import CompanyManager from "./CompanyManager";
import dash from "../privateDashboard.module.css";
import styles from "./profile.module.css";

type Section = "personal" | "companies" | "security";
type Status = "loading" | "ready" | "denied" | "error";
type Personal = {
  full_name: string;
  phone: string;
  street_address: string;
  house_number: string;
  address_addition: string;
  postal_code: string;
  city: string;
  region: string;
  country: string;
};
const emptyPersonal: Personal = {
  full_name: "", phone: "", street_address: "", house_number: "",
  address_addition: "", postal_code: "", city: "", region: "", country: "",
};
type ContactRow = Omit<Personal, "full_name">;
const CONTACT_KEYS = [
  "phone","street_address","house_number","address_addition",
  "postal_code","city","region","country",
] as const;

export default function MemberProfilePage() {
  const router = useRouter();
  const [status, setStatus] = useState<Status>("loading");
  const [section, setSection] = useState<Section>("personal");
  const [userId, setUserId] = useState("");
  const [role, setRole] = useState("client");
  const [email, setEmail] = useState("");
  const [pendingEmail, setPendingEmail] = useState("");
  const [personal, setPersonal] = useState<Personal>(emptyPersonal);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [nextEmail, setNextEmail] = useState("");
  const [emailSaving, setEmailSaving] = useState(false);
  const [passwordCurrent, setPasswordCurrent] = useState("");
  const [passwordNext, setPasswordNext] = useState("");
  const [passwordRepeat, setPasswordRepeat] = useState("");
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  function setField<K extends keyof Personal>(field: K, value: Personal[K]) {
    setPersonal(current => ({ ...current, [field]: value }));
  }

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const supabase = createClient();
        const { data: auth, error: authError } = await supabase.auth.getUser();
        if (authError || !auth.user) {
          router.replace("/login");
          return;
        }
        const user = auth.user;
        const { data: profile, error: profileError } = await supabase
          .from("profiles").select("id,role,is_active,full_name,email")
          .eq("id", user.id).single();
        if (!mounted) return;
        if (profileError || !profile) throw new Error("Profile not available");
        if (profile.role === "admin") {
          router.replace("/admin"); return;
        }
        if (!["client","partner"].includes(profile.role) || profile.is_active !== true) {
          setStatus("denied"); return;
        }
        const { data: contact, error: contactError } = await supabase
          .from("mzs_member_contact_details")
          .select("phone,street_address,house_number,address_addition,postal_code,city,region,country")
          .eq("user_id", user.id).maybeSingle();
        if (!mounted) return;
        if (contactError) throw contactError;

        const details = (contact || {}) as Partial<ContactRow>;
        const next = { ...emptyPersonal, full_name: profile.full_name };
        for (const key of CONTACT_KEYS) next[key] = details[key] || "";
        setPersonal(next);
        setUserId(user.id);
        setRole(profile.role);
        setEmail(user.email || profile.email || "");
        setPendingEmail((user as { new_email?: string }).new_email || "");
        setStatus("ready");
      } catch {
        if (mounted) {
          setError("Unable to load your personal account information.");
          setStatus("error");
        }
      }
    }
    void load();
    return () => { mounted = false; };
  }, [router]);

  function switchSection(next: Section) {
    if (saving || emailSaving || passwordSaving) return;
    setSection(next); setNotice(""); setError("");
  }

  async function savePersonal(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    setNotice(""); setError("");
    const fullName = personal.full_name.trim().replace(/\s+/g," ");
    if (fullName.length < 3 || fullName.length > 120) {
      setError("Please enter a full name of 3–120 characters.");
      return;
    }
    setSaving(true);
    try {
      const { data, error: failure } = await createClient().rpc("mzs_set_member_contact", {
        p_full_name: fullName,
        p_phone: personal.phone,
        p_street_address: personal.street_address,
        p_house_number: personal.house_number,
        p_address_addition: personal.address_addition,
        p_postal_code: personal.postal_code,
        p_city: personal.city,
        p_region: personal.region,
        p_country: personal.country,
      });
      if (failure || data !== true) throw new Error("Save unconfirmed");
      setPersonal(current => ({ ...current, full_name: fullName }));
      setNotice("Your personal and address information has been saved.");
    } catch {
      setError("We could not confirm the update. Please try again later.");
    } finally {
      setSaving(false);
    }
  }

  async function saveEmail(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (emailSaving) return;
    setNotice(""); setError("");
    const requested = nextEmail.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(requested) || requested.length > 254) {
      setError("Please enter a valid email address.");
      return;
    }
    if (requested === email.toLowerCase()) {
      setError("This is already your current email address.");
      return;
    }
    setEmailSaving(true);
    try {
      const { error: failure } = await createClient().auth.updateUser(
        { email: requested },
        { emailRedirectTo: window.location.origin + "/private/profile" }
      );
      if (failure) throw failure;
      setPendingEmail(requested);
      setNextEmail("");
      setNotice("Your email change was requested. Follow the confirmation email(s). Your current address remains active until the change is verified.");
    } catch {
      setError("We could not request this email change. Check the address or contact MZS Group.");
    } finally {
      setEmailSaving(false);
    }
  }

  async function savePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (passwordSaving) return;
    setNotice(""); setError("");
    if (!passwordCurrent) {
      setError("Enter your current password to continue.");
      return;
    }
    if (passwordNext.length < 8 || passwordNext.length > 128) {
      setError("Your new password must contain at least 8 characters.");
      return;
    }
    if (passwordNext !== passwordRepeat) {
      setError("The new passwords do not match.");
      return;
    }
    if (passwordCurrent === passwordNext) {
      setError("Choose a password different from your current password.");
      return;
    }
    setPasswordSaving(true);
    try {
      const supabase = createClient();
      // Reauthenticate before any password change. Do not keep or log secrets.
      const { data: verified, error: signInError } = await supabase.auth
        .signInWithPassword({ email, password: passwordCurrent });
      if (signInError || !verified.user || verified.user.id !== userId) {
        throw new Error("Reauthentication failed");
      }
      const { error: updateError } = await supabase.auth.updateUser({
        password: passwordNext,
      });
      if (updateError) throw updateError;
      setNotice("Your password has been changed successfully.");
      setPasswordCurrent(""); setPasswordNext(""); setPasswordRepeat("");
    } catch {
      setPasswordCurrent(""); setPasswordNext(""); setPasswordRepeat("");
      setError("Password change not confirmed. Check your current password and try again.");
    } finally {
      setPasswordSaving(false);
    }
  }

  async function signOut() {
    if (signingOut) return;
    setSigningOut(true);
    try {
      const { error: signOutError } = await createClient().auth.signOut();
      if (signOutError) throw signOutError;
      router.replace("/");
      router.refresh();
    } catch {
      setError("Unable to sign out. Please try again.");
      setSigningOut(false);
    }
  }

  return <main className={dash.page}>
    <header className={dash.header}>
      <div className={dash.headerInner}>
        <Link href="/" className={dash.brand} aria-label="MZS Group Home">
          <span className={dash.brandMzs}>MZS</span>
          <span className={dash.brandGroup}>GROUP</span>
        </Link>
        <div className={dash.headerRight}>
          <span className={dash.accessLabel}>
            {role === "partner" ? "PARTNER ACCESS" : "PRIVATE CLIENT"}
          </span>
          <Link className={dash.headerLink} href="/private">
            My Dashboard <span aria-hidden="true">↗</span>
          </Link>
          <button className={dash.signout} type="button" disabled={signingOut}
            onClick={() => void signOut()}>
            {signingOut ? "Signing out…" : "Sign out"}
          </button>
        </div>
      </div>
    </header>

    <div className={styles.shell}>
      <nav className={styles.crumb} aria-label="Breadcrumb">
        <Link href="/private">Private Collection</Link><span>/</span>
        <span>My Profile</span>
      </nav>
      <section className={styles.hero}>
        <div>
          <p className={styles.kicker}>MZS GROUP · PRIVATE ACCESS</p>
          <h1>My Profile.</h1>
          <p className={styles.intro}>
            Your personal information, business relationships and account security —
            managed privately in one place.
          </p>
        </div>
        <div className={styles.heroAside}>
          <strong>Private. Independent. International.</strong>
          Only you and authorised MZS administrators can review your account
          details. Your project access stays independent of these settings.
        </div>
      </section>

      {status === "loading" && <p className={styles.empty} role="status">
        Preparing your private profile…
      </p>}
      {status === "denied" && <section className={styles.panel}>
        <h2 className={styles.panelTitle}>Account access is pending.</h2>
        <p className={styles.note}>Please contact MZS Group if you need assistance.</p>
      </section>}
      {status === "error" && <p className={styles.error} role="alert">{error}</p>}

      {status === "ready" && <>
        <nav className={styles.tabs} aria-label="Profile sections">
          <button className={styles.tab} type="button" aria-pressed={section === "personal"}
            onClick={() => switchSection("personal")}>Personal Details</button>
          <button className={styles.tab} type="button" aria-pressed={section === "companies"}
            onClick={() => switchSection("companies")}>My Companies</button>
          <button className={styles.tab} type="button" aria-pressed={section === "security"}
            onClick={() => switchSection("security")}>Email &amp; Security</button>
        </nav>

        {section === "personal" && <section className={styles.panel}>
          <div className={styles.panelHead}>
            <div>
              <p className={styles.kicker}>PERSONAL INFORMATION</p>
              <h2 className={styles.panelTitle}>Contact &amp; Address.</h2>
              <p className={styles.panelDescription}>
                Keep your name, contact information and postal address up to date.
                All fields except your name are optional.
              </p>
            </div>
          </div>
          {notice && <p className={styles.success} role="status">{notice}</p>}
          {error && <p className={styles.error} role="alert">{error}</p>}
          <form className={styles.form} style={{ marginTop: 25 }}
            onSubmit={savePersonal} aria-busy={saving}>
            <div className={styles.grid}>
              <label className={styles.field}>Full name *
                <input value={personal.full_name} maxLength={120} minLength={3}
                  autoComplete="name" required disabled={saving}
                  onChange={e => setField("full_name",e.target.value)}/>
              </label>
              <label className={styles.field}>Telephone
                <input value={personal.phone} maxLength={40} type="tel"
                  autoComplete="tel" disabled={saving}
                  onChange={e => setField("phone",e.target.value)} />
              </label>
              <label className={styles.field}>Street name
                <input value={personal.street_address} maxLength={160}
                  autoComplete="address-line1" disabled={saving}
                  onChange={e => setField("street_address",e.target.value)}/>
              </label>
              <label className={styles.field}>House / building number
                <input value={personal.house_number} maxLength={24}
                  disabled={saving}
                  onChange={e => setField("house_number",e.target.value)}/>
              </label>
              <label className={styles.field}>Apartment / additional address
                <input value={personal.address_addition} maxLength={80}
                  autoComplete="address-line2" disabled={saving}
                  onChange={e => setField("address_addition",e.target.value)}/>
              </label>
              <label className={styles.field}>Postal code
                <input value={personal.postal_code} maxLength={24}
                  autoComplete="postal-code" disabled={saving}
                  onChange={e => setField("postal_code",e.target.value)}/>
              </label>
              <label className={styles.field}>City
                <input value={personal.city} maxLength={120}
                  autoComplete="address-level2" disabled={saving}
                  onChange={e => setField("city",e.target.value)}/>
              </label>
              <label className={styles.field}>State / Province / Region
                <input value={personal.region} maxLength={120}
                  autoComplete="address-level1" disabled={saving}
                  onChange={e => setField("region",e.target.value)}/>
              </label>
              <label className={styles.field + " " + styles.fieldFull}>Country
                <input value={personal.country} maxLength={120}
                  autoComplete="country-name" disabled={saving}
                  onChange={e => setField("country",e.target.value)}/>
              </label>
            </div>
            <div className={styles.actions}>
              <button type="submit" className={styles.primary} disabled={saving}>
                {saving ? "Saving…" : "Save Personal Details →"}
              </button>
            </div>
          </form>
        </section>}

        {section === "companies" && <CompanyManager userId={userId} />}

        {section === "security" && <div className={styles.securityGrid}>
          <section className={styles.panel}>
            <div className={styles.panelHead}>
              <div>
                <p className={styles.kicker}>EMAIL ADDRESS</p>
                <h2 className={styles.panelTitle}>Your Email.</h2>
                <p className={styles.panelDescription}>
                  We will send verification instructions when you request a change.
                </p>
              </div>
            </div>
            {notice && <p className={styles.success} role="status">{notice}</p>}
            {error && <p className={styles.error} role="alert">{error}</p>}
            <form className={styles.form} style={{ marginTop: 22 }}
              onSubmit={saveEmail} aria-busy={emailSaving}>
              <label className={styles.field}>Current email address
                <span className={styles.readOnly}>{email}</span>
              </label>
              {pendingEmail && pendingEmail.toLowerCase() !== email.toLowerCase() &&
                <p className={styles.note}>Awaiting confirmation: {pendingEmail}</p>}
              <label className={styles.field}>New email address
                <input type="email" value={nextEmail} maxLength={254}
                  autoComplete="email" required disabled={emailSaving}
                  onChange={e => setNextEmail(e.target.value)} />
              </label>
              <button className={styles.primary} type="submit" disabled={emailSaving}>
                {emailSaving ? "Requesting…" : "Request Email Change →"}
              </button>
              <p className={styles.note}>
                Depending on your security settings, both the old and new
                address may need confirmation. Your project access will remain unchanged.
              </p>
            </form>
          </section>
          <section className={styles.panel}>
            <div className={styles.panelHead}>
              <div>
                <p className={styles.kicker}>ACCOUNT SECURITY</p>
                <h2 className={styles.panelTitle}>Change Password.</h2>
                <p className={styles.panelDescription}>
                  Confirm your current password, then create a new one
                  containing at least 8 characters.
                </p>
              </div>
            </div>
            {notice && <p className={styles.success} role="status">{notice}</p>}
            {error && <p className={styles.error} role="alert">{error}</p>}
            <form className={styles.form} style={{ marginTop: 22 }}
              onSubmit={savePassword} aria-busy={passwordSaving}>
              <label className={styles.field}>Current password
                <input type="password" required autoComplete="current-password"
                  value={passwordCurrent} disabled={passwordSaving}
                  onChange={e => setPasswordCurrent(e.target.value)} />
              </label>
              <label className={styles.field}>New password
                <input type="password" minLength={8} maxLength={128} required
                  autoComplete="new-password" value={passwordNext}
                  disabled={passwordSaving} onChange={e => setPasswordNext(e.target.value)} />
              </label>
              <label className={styles.field}>Confirm new password
                <input type="password" minLength={8} maxLength={128} required
                  autoComplete="new-password" value={passwordRepeat}
                  disabled={passwordSaving} onChange={e => setPasswordRepeat(e.target.value)} />
              </label>
              <button className={styles.primary} type="submit" disabled={passwordSaving}>
                {passwordSaving ? "Updating…" : "Update Password →"}
              </button>
              <p className={styles.note}>
                Your password is handled by Supabase Auth, not stored in your
                personal information or company records.
              </p>
            </form>
          </section>
        </div>}
      </>}
    </div>
  </main>;
}
