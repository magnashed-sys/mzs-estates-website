"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "../../lib/supabase/client";
import styles from "./PublicHeader.module.css";

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

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "flex-end",
          flexWrap: "wrap",
          columnGap: "clamp(14px, 2.5vw, 34px)",
          rowGap: "8px",
          minWidth: 0,
        }}
      >
        <span className={`${styles.privateLabel} mzs-private-label`}>
          Private Access
        </span>

        {dashboardHref && (
          <Link
            href={dashboardHref}
            aria-label="Go to my dashboard"
            style={{
              color: "#d5c09a",
              fontFamily: "Arial, Helvetica, sans-serif",
              fontSize: "11px",
              fontWeight: 600,
              letterSpacing: "0.12em",
              lineHeight: 1.6,
              textDecoration: "none",
              textTransform: "uppercase",
              whiteSpace: "nowrap",
              borderBottom: "1px solid rgba(213, 192, 154, 0.55)",
              paddingBottom: "3px",
            }}
          >
            My Dashboard <span aria-hidden="true">↗</span>
          </Link>
        )}
      </div>
    </header>
  );
}
