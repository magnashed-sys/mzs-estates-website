"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "../../lib/supabase/client";
import styles from "./PublicHeader.module.css";

const publicNavigation = [
  { href: "/real-estate", label: "Real Estate" },
  { href: "/private-capital", label: "Private Capital" },
  { href: "/login", label: "Client & Partner Login" },
  { href: "/request-access", label: "Request Access" },
] as const;

type DashboardHref = "/admin" | "/private" | null;

/**
 * Shared MZS Group public header.
 * Shows a dashboard shortcut only for active, authenticated MZS accounts.
 * The dashboard pages themselves remain protected by their own access checks.
 */
export default function PublicHeader() {
  const [dashboardHref, setDashboardHref] = useState<DashboardHref>(null);

  useEffect(() => {
    let mounted = true;
    const supabase = createClient();

    async function updateDashboardLink() {
      try {
        const { data: auth, error: authError } = await supabase.auth.getUser();
        if (!mounted) return;

        if (authError || !auth.user) {
          setDashboardHref(null);
          return;
        }

        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("role,is_active")
          .eq("id", auth.user.id)
          .maybeSingle();

        if (!mounted) return;

        if (profileError || !profile || profile.is_active !== true) {
          setDashboardHref(null);
          return;
        }

        if (profile.role === "admin") {
          setDashboardHref("/admin");
        } else if (profile.role === "client" || profile.role === "partner") {
          setDashboardHref("/private");
        } else {
          setDashboardHref(null);
        }
      } catch {
        if (mounted) setDashboardHref(null);
      }
    }

    void updateDashboardLink();

    // Keep the shortcut in sync when users log in or out while a public
    // page is open. Defer Supabase calls until the auth callback is complete.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") {
        if (mounted) setDashboardHref(null);
      } else if (event === "SIGNED_IN" || event === "USER_UPDATED") {
        window.setTimeout(() => {
          if (mounted) void updateDashboardLink();
        }, 0);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  return (
    <header className={`${styles.header} mzs-home-header`}>
      <Link
        href="/"
        className={`${styles.wordmark} mzs-wordmark`}
        aria-label="MZS Group — Home"
      >
        <span className={`${styles.monogram} mzs-monogram`}>MZS</span>
        <span className={`${styles.groupLabel} mzs-group-label`}>GROUP</span>
      </Link>

      <div className={styles.navigationRegion}>
        <nav className={styles.desktopNavigation} aria-label="Main navigation">
          {publicNavigation.map(({ href, label }) => (
            <Link href={href} className={styles.navLink} key={href}>
              {label} <span className={styles.navArrow} aria-hidden="true">↗</span>
            </Link>
          ))}
          {dashboardHref && (
            <Link href={dashboardHref} className={styles.dashboardLink}>
              My Dashboard <span className={styles.navArrow} aria-hidden="true">↗</span>
            </Link>
          )}
        </nav>

        <details className={styles.mobileNavigation}>
          <summary className={styles.menuToggle}>
            <span>Menu</span>
            <span className={styles.menuIcon} aria-hidden="true">☰</span>
          </summary>
          <nav className={styles.mobilePanel} aria-label="Mobile main navigation">
            {publicNavigation.map(({ href, label }) => (
              <Link href={href} className={styles.mobileLink} key={href}>
                {label} <span className={styles.navArrow} aria-hidden="true">↗</span>
              </Link>
            ))}
            {dashboardHref && (
              <Link href={dashboardHref} className={styles.mobileLink}>
                My Dashboard <span className={styles.navArrow} aria-hidden="true">↗</span>
              </Link>
            )}
          </nav>
        </details>
      </div>
    </header>
  );
}
