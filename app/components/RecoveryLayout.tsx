import type { ReactNode } from "react";
import PublicHeader from "./PublicHeader";
import HomeContactFooter from "./HomeContactFooter";
import styles from "../public-access-refresh.module.css";

/** Same MZS header/footer and role-specific photography as the login pages. */
export default function RecoveryLayout({
  role,
  children,
}: {
  role: "client" | "partner";
  children: ReactNode;
}) {
  const background = role === "partner"
    ? "/images/partner-login-bg.webp"
    : "/images/client-login-bg.webp";

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
      <section className="login-container" style={{ position: "relative" }}>
        {children}
      </section>
      <div className={styles.publicFooter}>
        <HomeContactFooter email="info@mzsgroup.eu" />
      </div>
    </main>
  );
}
