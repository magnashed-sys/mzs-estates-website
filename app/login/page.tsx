"use client";
import RussianAccessNotice from "../components/RussianAccessNotice";

import styles from "../public-access-refresh.module.css";
import PublicHeader from "../components/PublicHeader";
import HomeContactFooter from "../components/HomeContactFooter";

import { FormEvent, useState } from "react";
import {useLocale, useTranslations} from "next-intl";
import {rememberLocale} from "../../i18n/client-preference";
import recoveryStyles from "../account-recovery.module.css";
import { createClient } from "../../lib/supabase/client";

export default function LoginPage() {
  const t = useTranslations("Login");
  const locale = useLocale();
  const background = "/images/client-login-bg.webp";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;

    setError("");
    setLoading(true);

    const supabase = createClient();

    try {
      const { data, error: authError } =
        await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });

      if (authError || !data.user) {
        setError(t('invalid'));
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("role, is_active")
        .eq("id", data.user.id)
        .single();

      if (profileError || !profile) {
        await supabase.auth.signOut();
        setError(
          t('verify')
        );
        return;
      }

      if (!profile.is_active) {
        await supabase.auth.signOut();
        setError(
          t('inactive')
        );
        return;
      }

      rememberLocale(locale);

      switch (profile.role) {
        case "admin":
          window.location.replace("/admin");
          break;
        case "client":
        case "partner": {
          // An explicitly assigned Capital operator is still a standard
          // client/partner in the legacy profile model, never a global admin.
          // If the scoped RPC does not exist (e.g. Production before release),
          // preserve the regular private client destination.
          const { data: capitalScope, error: scopeError } = await supabase.rpc(
            "mzs_has_department_scope",
            { p_department: "capital" }
          );
          window.location.replace(!scopeError && capitalScope === true
            ? "/admin/group/capital"
            : "/private");
          break;
        }
        default:
          await supabase.auth.signOut();
          setError(t('role'));
          return;
      }


    } catch (err) {
      console.error("Login error:", err);
      setError(t('failed'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <main
      className={`login-page ${styles.page} ${styles.loginPage}`}
      style={{
        position: "relative",
        isolation: "isolate",
        minHeight: "100dvh",
        backgroundColor: "#0b0b0a",
        backgroundImage: `url("${background}")`,
        backgroundPosition: "center center",
        backgroundSize: "cover",
        backgroundRepeat: "no-repeat",
      }}
    >
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: 0,
          zIndex: -1,
          background:
            "linear-gradient(90deg,rgba(8,8,8,.77),rgba(8,8,8,.44) 65%,rgba(8,8,8,.35)),linear-gradient(0deg,rgba(8,8,8,.8),transparent 45%,rgba(8,8,8,.3))",
        }}
      />

      <PublicHeader />

      <section
        className="login-container"
        style={{ position: "relative" }}
      >
        <p className="eyebrow">{t("private_access")}</p>
        <h1 className={styles.loginTitle}>{t("title")}</h1>
        <p className="login-intro">
          {t("intro")}
        </p>

        <RussianAccessNotice />
        <form
          className="login-form"
          onSubmit={handleLogin}
          aria-busy={loading}
        >
          <label>
            {t("email")}
            <input
              type="email"
              name="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              disabled={loading}
            />
          </label>

          <label>
            {t("password")}
            <input
              type="password"
              name="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              disabled={loading}
            />
          </label>

          <div className={recoveryStyles.forgotLinkRow}>
            <a
              href="/forgot-password"
              className={recoveryStyles.textLink}
            >
              {t("forgot")} →
            </a>
          </div>

          {error && (
            <p className="login-error" role="alert">
              {error}
            </p>
          )}

          <button type="submit" disabled={loading}>
            {loading ? t("signing_in") : t("login") + " →"}
          </button>
        </form>

        <p className="login-note">
          {t("note")}
        </p>
      </section>

      <div className={styles.publicFooter}>
        <HomeContactFooter email="info@mzsgroup.eu" />
      </div>
    </main>
  );
}
