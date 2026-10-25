"use client";
import ArrowUpRightIcon from "../../components/ArrowUpRightIcon";
import {useLocale, useTranslations} from "next-intl";
import {isLocale, localizedPath} from "../../../i18n/public-routing";

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
  const t = useTranslations("MemberUI");
  const locale = useLocale();
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
        // A new Preview branch may still inherit Production credentials.
        // Fail closed until this branch is explicitly linked to MZS Staging.
        const previewHost = window.location.hostname.startsWith("mzs-group-") &&
          window.location.hostname.endsWith("-mzs3.vercel.app");
        if (previewHost &&
            process.env.NEXT_PUBLIC_SUPABASE_URL !==
              "https://senonkpxdtlhyhrubicg.supabase.co") {
          setError(t("thisPreviewIsNotYetLinkedToMzs"));
          setStatus("error");
          return;
        }
        const supabase = createClient();
        const { data: auth, error: authError } = await supabase.auth.getUser();
        if (authError || !auth.user) {
          window.location.replace(localizedPath("/login", isLocale(locale) ? locale : "en"));
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
          setError(t("unableToLoadYourPersonalAccountInformation"));
          setStatus("error");
        }
      }
    }
    void load();
    return () => { mounted = false; };
  }, [router, t, locale]);

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
      setError(t("pleaseEnterAFullNameOf3120Characters"));
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
      setNotice(t("yourPersonalAndAddressInformationHasBeenSaved"));
    } catch {
      setError(t("weCouldNotConfirmTheUpdatePleaseTry"));
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
      setError(t("pleaseEnterAValidEmailAddress"));
      return;
    }
    if (requested === email.toLowerCase()) {
      setError(t("thisIsAlreadyYourCurrentEmailAddress"));
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
      setNotice(t("yourEmailChangeWasRequestedFollowTheConfirmation"));
    } catch {
      setError(t("weCouldNotRequestThisEmailChangeCheck"));
    } finally {
      setEmailSaving(false);
    }
  }

  async function savePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (passwordSaving) return;
    setNotice(""); setError("");
    if (!passwordCurrent) {
      setError(t("enterYourCurrentPasswordToContinue"));
      return;
    }
    if (passwordNext.length < 8 || passwordNext.length > 128) {
      setError(t("yourNewPasswordMustContainAtLeast8"));
      return;
    }
    if (passwordNext !== passwordRepeat) {
      setError(t("theNewPasswordsDoNotMatch"));
      return;
    }
    if (passwordCurrent === passwordNext) {
      setError(t("chooseAPasswordDifferentFromYourCurrentPassword"));
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
      setNotice(t("yourPasswordHasBeenChangedSuccessfully"));
      setPasswordCurrent(""); setPasswordNext(""); setPasswordRepeat("");
    } catch {
      setPasswordCurrent(""); setPasswordNext(""); setPasswordRepeat("");
      setError(t("passwordChangeNotConfirmedCheckYourCurrentPassword"));
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
      window.location.replace(localizedPath("/", isLocale(locale) ? locale : "en"));
    } catch {
      setError(t("unableToSignOutPleaseTryAgain"));
      setSigningOut(false);
    }
  }

  return <main className={dash.page}>
    <header className={dash.header}>
      <div className={dash.headerInner}>
        <a href={localizedPath("/", isLocale(locale) ? locale : "en")} className={dash.brand} aria-label={t("mzsGroupHome")}>
          <span className={dash.brandMzs}>MZS</span>
          <span className={dash.brandGroup}>GROUP</span>
        </a>
        <div className={dash.headerRight}>
          <span className={dash.accessLabel}>
            {role === "partner" ? t("partnerAccess") : t("privateClient")}
          </span>
          <Link className={dash.headerLink} href="/private"> {t("myDashboard")} <span aria-hidden="true"><ArrowUpRightIcon /></span>
          </Link>
          <button className={dash.signout} type="button" disabled={signingOut}
            onClick={() => void signOut()}>
            {signingOut ? t("signingOut") : t("signOut")}
          </button>
        </div>
      </div>
    </header>

    <div className={styles.shell}>
      <nav className={styles.crumb} aria-label={t("breadcrumb")}>
        <Link href="/private">{t("privateCollection")}</Link><span>/</span>
        <span>{t("myProfile")}</span>
      </nav>
      <section className={styles.hero}>
        <div>
          <p className={styles.kicker}>{t("mzsGroupPrivateAccess")}</p>
          <h1>{t("myProfileLabel")}</h1>
          <p className={styles.intro}> {t("yourPersonalInformationBusinessRelationshipsAndAccountSecurity")} </p>
        </div>
        <div className={styles.heroAside}>
          <strong>Private. Independent. International.</strong> {t("onlyYouAndAuthorisedMzsAdministratorsCanReview")} </div>
      </section>

      {status === "loading" && <p className={styles.empty} role="status"> {t("preparingYourPrivateProfile")} </p>}
      {status === "denied" && <section className={styles.panel}>
        <h2 className={styles.panelTitle}>{t("accountAccessIsPending")}</h2>
        <p className={styles.note}>{t("pleaseContactMzsGroupIfYouNeedAssistance")}</p>
      </section>}
      {status === "error" && <p className={styles.error} role="alert">{error}</p>}

      {status === "ready" && <>
        <nav className={styles.tabs} aria-label={t("profileSections")}>
          <button className={styles.tab} type="button" aria-pressed={section === "personal"}
            onClick={() => switchSection("personal")}>{t("personalDetails")}</button>
          <button className={styles.tab} type="button" aria-pressed={section === "companies"}
            onClick={() => switchSection("companies")}>{t("myCompanies")}</button>
          <button className={styles.tab} type="button" aria-pressed={section === "security"}
            onClick={() => switchSection("security")}>{t("emailAmpSecurity")}</button>
        </nav>

        {section === "personal" && <section className={styles.panel}>
          <div className={styles.panelHead}>
            <div>
              <p className={styles.kicker}>{t("personalInformation")}</p>
              <h2 className={styles.panelTitle}>{t("contactAmpAddress")}</h2>
              <p className={styles.panelDescription}> {t("keepYourNameContactInformationAndPostalAddress")} </p>
            </div>
          </div>
          {notice && <p className={styles.success} role="status">{notice}</p>}
          {error && <p className={styles.error} role="alert">{error}</p>}
          <form className={styles.form} style={{ marginTop: 25 }}
            onSubmit={savePersonal} aria-busy={saving}>
            <div className={styles.grid}>
              <label className={styles.field}>{t("fullName")} <input value={personal.full_name} maxLength={120} minLength={3}
                  autoComplete="name" required disabled={saving}
                  onChange={e => setField("full_name",e.target.value)}/>
              </label>
              <label className={styles.field}>{t("telephone")} <input value={personal.phone} maxLength={40} type="tel"
                  autoComplete="tel" disabled={saving}
                  onChange={e => setField("phone",e.target.value)} />
              </label>
              <label className={styles.field}>{t("streetName")} <input value={personal.street_address} maxLength={160}
                  autoComplete="address-line1" disabled={saving}
                  onChange={e => setField("street_address",e.target.value)}/>
              </label>
              <label className={styles.field}>{t("houseBuildingNumber")} <input value={personal.house_number} maxLength={24}
                  disabled={saving}
                  onChange={e => setField("house_number",e.target.value)}/>
              </label>
              <label className={styles.field}>{t("apartmentAdditionalAddress")} <input value={personal.address_addition} maxLength={80}
                  autoComplete="address-line2" disabled={saving}
                  onChange={e => setField("address_addition",e.target.value)}/>
              </label>
              <label className={styles.field}>{t("postalCode")} <input value={personal.postal_code} maxLength={24}
                  autoComplete="postal-code" disabled={saving}
                  onChange={e => setField("postal_code",e.target.value)}/>
              </label>
              <label className={styles.field}>{t("city")} <input value={personal.city} maxLength={120}
                  autoComplete="address-level2" disabled={saving}
                  onChange={e => setField("city",e.target.value)}/>
              </label>
              <label className={styles.field}>{t("stateProvinceRegion")} <input value={personal.region} maxLength={120}
                  autoComplete="address-level1" disabled={saving}
                  onChange={e => setField("region",e.target.value)}/>
              </label>
              <label className={styles.field + " " + styles.fieldFull}>{t("country")} <input value={personal.country} maxLength={120}
                  autoComplete="country-name" disabled={saving}
                  onChange={e => setField("country",e.target.value)}/>
              </label>
            </div>
            <div className={styles.actions}>
              <button type="submit" className={styles.primary} disabled={saving}>
                {saving ? t("saving") : t("savePersonalDetails")}
              </button>
            </div>
          </form>
        </section>}

        {section === "companies" && <CompanyManager userId={userId} />}

        {section === "security" && <div className={styles.securityGrid}>
          <section className={styles.panel}>
            <div className={styles.panelHead}>
              <div>
                <p className={styles.kicker}>{t("emailAddress")}</p>
                <h2 className={styles.panelTitle}>{t("yourEmail")}</h2>
                <p className={styles.panelDescription}> {t("weWillSendVerificationInstructionsWhenYouRequest")} </p>
              </div>
            </div>
            {notice && <p className={styles.success} role="status">{notice}</p>}
            {error && <p className={styles.error} role="alert">{error}</p>}
            <form className={styles.form} style={{ marginTop: 22 }}
              onSubmit={saveEmail} aria-busy={emailSaving}>
              <label className={styles.field}>{t("currentEmailAddress")} <span className={styles.readOnly}>{email}</span>
              </label>
              {pendingEmail && pendingEmail.toLowerCase() !== email.toLowerCase() &&
                <p className={styles.note}>{t("awaitingConfirmation")} {pendingEmail}</p>}
              <label className={styles.field}>{t("newEmailAddress")} <input type="email" value={nextEmail} maxLength={254}
                  autoComplete="email" required disabled={emailSaving}
                  onChange={e => setNextEmail(e.target.value)} />
              </label>
              <button className={styles.primary} type="submit" disabled={emailSaving}>
                {emailSaving ? t("requesting") : t("requestEmailChange")}
              </button>
              <p className={styles.note}> {t("dependingOnYourSecuritySettingsBothTheOld")} </p>
            </form>
          </section>
          <section className={styles.panel}>
            <div className={styles.panelHead}>
              <div>
                <p className={styles.kicker}>{t("accountSecurity")}</p>
                <h2 className={styles.panelTitle}>{t("changePassword")}</h2>
                <p className={styles.panelDescription}> {t("confirmYourCurrentPasswordThenCreateANew")} </p>
              </div>
            </div>
            {notice && <p className={styles.success} role="status">{notice}</p>}
            {error && <p className={styles.error} role="alert">{error}</p>}
            <form className={styles.form} style={{ marginTop: 22 }}
              onSubmit={savePassword} aria-busy={passwordSaving}>
              <label className={styles.field}>{t("currentPassword")} <input type="password" required autoComplete="current-password"
                  value={passwordCurrent} disabled={passwordSaving}
                  onChange={e => setPasswordCurrent(e.target.value)} />
              </label>
              <label className={styles.field}>{t("newPassword")} <input type="password" minLength={8} maxLength={128} required
                  autoComplete="new-password" value={passwordNext}
                  disabled={passwordSaving} onChange={e => setPasswordNext(e.target.value)} />
              </label>
              <label className={styles.field}>{t("confirmNewPassword")} <input type="password" minLength={8} maxLength={128} required
                  autoComplete="new-password" value={passwordRepeat}
                  disabled={passwordSaving} onChange={e => setPasswordRepeat(e.target.value)} />
              </label>
              <button className={styles.primary} type="submit" disabled={passwordSaving}>
                {passwordSaving ? t("updating") : t("updatePassword")}
              </button>
              <p className={styles.note}> {t("yourPasswordIsHandledBySupabaseAuthNot")} </p>
            </form>
          </section>
        </div>}
      </>}
    </div>
  </main>;
}
