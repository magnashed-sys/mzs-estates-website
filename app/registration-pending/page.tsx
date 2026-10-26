import {getTranslations, getLocale} from "next-intl/server";
import {localizedPath} from "../../i18n/public-routing";
import PublicHeader from "../components/PublicHeader";
import HomeContactFooter from "../components/HomeContactFooter";
import styles from "../public-access-refresh.module.css";

export async function generateMetadata() { const t = await getTranslations("AccountUI"); return {title: t("a090"), robots: {index:false, follow:false}}; }

export default async function RegistrationPendingPage() {
 const t = await getTranslations("AccountUI");
 const locale = await getLocale();
  return (
    <main className={styles.page} style={{
      minHeight: "100svh", backgroundColor: "#0b0b0a", color: "#f1ede6",
      backgroundImage: "linear-gradient(110deg, rgba(7,9,10,.92), rgba(7,9,10,.62)), url('/images/request-access-bg.webp')",
      backgroundPosition: "center", backgroundSize: "cover",
    }}>
      <PublicHeader />
      <section style={{
        maxWidth: 740, margin: "0 auto", padding: "clamp(64px,10vw,140px) 24px",
        minHeight: "60svh", position: "relative",
      }}>
        <p style={{ color: "#d5c09a", letterSpacing: "0.2em", fontSize: 12 }}>
          {t("a091")}</p>
        <h1 style={{
          fontFamily: "Georgia, 'Times New Roman', serif", fontWeight: 400,
          fontSize: "clamp(44px,6vw,76px)", lineHeight: 1.12, margin: "28px 0",
        }}>
          {t("a092")}</h1>
        <p style={{ lineHeight: 1.9, fontSize: 17, color: "#d2c9bd", maxWidth: 650 }}>
          {t("a093")}</p>
        <p style={{ lineHeight: 1.9, color: "#d2c9bd" }}>
          {t("a094")}</p>
        <a href={localizedPath("/login", locale)} style={{
          color: "#d5c09a", display: "inline-block", marginTop: 28,
          textDecoration: "none", borderBottom: "1px solid #d5c09a", paddingBottom: 5,
        }}>
          {t("a095")}</a>
      </section>
      <div className={styles.publicFooter}><HomeContactFooter /></div>
    </main>
  );
}
