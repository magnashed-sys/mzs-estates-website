"use client";
import ArrowUpRightIcon from "./ArrowUpRightIcon";
import {useLocale, useTranslations} from 'next-intl';

import { useEffect, useState } from "react";
import LanguageSwitcher from "./LanguageSwitcher";
import {localizedPath} from "../../i18n/public-routing";
import { createClient } from "../../lib/supabase/client";
import styles from "./PublicHeader.module.css";



type DashboardHref = "/admin" | "/private" | null;

/**
 * Shared MZS Group public header.
 * Shows a dashboard shortcut only for active, authenticated MZS accounts.
 * The dashboard pages themselves remain protected by their own access checks.
 */
export default function PublicHeader() {
  const t = useTranslations('Header');
  const locale = useLocale();
const publicNavigation = [
  { href: "/real-estate", label: t('real_estate') },
  { href: "/private-capital", label: t('private_capital') },
  { href: "/about", label: t('about') },
  { href: "/login", label: t('login') },
] as const;
  const [dashboardHref, setDashboardHref] = useState<DashboardHref>(null);
  // Show Login to visitors; replace it with My Dashboard for approved signed-in accounts.
  const visibleNavigation = dashboardHref
    ? publicNavigation.filter(({ href }) => href !== "/login")
    : publicNavigation;

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
      <a
        href={localizedPath("/", locale)}
        className={`${styles.wordmark} mzs-wordmark`}
        aria-label={t('mzs_group_home')}
      >
        <span className={`${styles.monogram} mzs-monogram`}>MZS</span>
        <span className={`${styles.groupLabel} mzs-group-label`}>GROUP</span>
      </a>

      <div className={styles.navigationRegion}>
        <nav className={styles.desktopNavigation} aria-label={t('main_navigation')}>
          {visibleNavigation.map(({ href, label }) => (
            <a href={localizedPath(href, locale)} className={styles.navLink} key={href}>
              {label} <span className={styles.navArrow} aria-hidden="true"><ArrowUpRightIcon /></span>
            </a>
          ))}
          {dashboardHref && (
            <a href={dashboardHref} className={styles.dashboardLink}> {t('my_dashboard')} <span className={styles.navArrow} aria-hidden="true"><ArrowUpRightIcon /></span>
            </a>
          )}
        </nav>

        <details className={styles.mobileNavigation}>
          <summary className={styles.menuToggle}>
            <span>{t('menu')}</span>
            <span className={styles.menuIcon} aria-hidden="true">☰</span>
          </summary>
          <nav className={styles.mobilePanel} aria-label={t('mobile_main_navigation')}>
            {visibleNavigation.map(({ href, label }) => (
              <a href={localizedPath(href, locale)} className={styles.mobileLink} key={href}>
                {label} <span className={styles.navArrow} aria-hidden="true"><ArrowUpRightIcon /></span>
              </a>
            ))}
            {dashboardHref && (
              <a href={dashboardHref} className={styles.mobileLink}> {t('my_dashboard')} <span className={styles.navArrow} aria-hidden="true"><ArrowUpRightIcon /></span>
              </a>
            )}
          </nav>
        </details>
        <LanguageSwitcher />
      </div>
    </header>
  );
}
