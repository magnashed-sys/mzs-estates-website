import Link from "next/link";
import PublicHeader from "../components/PublicHeader";
import HomeContactFooter from "../components/HomeContactFooter";
import styles from "../public-access-refresh.module.css";

export const metadata = {
  title: "Account Verification | MZS Group",
  robots: { index: false, follow: false },
};

export default function RegistrationPendingPage() {
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
          ACCOUNT SECURITY
        </p>
        <h1 style={{
          fontFamily: "Georgia, 'Times New Roman', serif", fontWeight: 400,
          fontSize: "clamp(44px,6vw,76px)", lineHeight: 1.12, margin: "28px 0",
        }}>
          Your private access is pending.
        </h1>
        <p style={{ lineHeight: 1.9, fontSize: 17, color: "#d2c9bd", maxWidth: 650 }}>
          If you have just registered, follow the verification link in your inbox.
          Once your email address is confirmed, MZS Group will review your
          application and select which opportunities you may access.
        </p>
        <p style={{ lineHeight: 1.9, color: "#d2c9bd" }}>
          Your account remains inactive until approval. We will email you
          separately when it has been activated.
        </p>
        <Link href="/login" style={{
          color: "#d5c09a", display: "inline-block", marginTop: 28,
          textDecoration: "none", borderBottom: "1px solid #d5c09a", paddingBottom: 5,
        }}>
          Return to Client &amp; Partner Login →
        </Link>
      </section>
      <div className={styles.publicFooter}><HomeContactFooter email="info@mzsgroup.eu" /></div>
    </main>
  );
}
