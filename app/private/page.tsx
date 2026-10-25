"use client";
import RelationshipOverview from "./RelationshipOverview";
import ArrowUpRightIcon from "../components/ArrowUpRightIcon";

import {useTranslations, useLocale} from "next-intl";
import LanguageSwitcher from "../components/LanguageSwitcher";
import {localizedPath} from "../../i18n/public-routing";
import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "../../lib/supabase/client";
import styles from "./privateDashboard.module.css";
import CapitalRequestForms from "./CapitalRequestForms";
import CapitalDossiers from "./capital/CapitalDossiers";

type Category = "rentals" | "investments" | "capital";
type ViewState = "loading" | "ready" | "pending" | "denied" | "error";
type MemberRole = "client" | "partner";

type Project = {
  id: string;
  slug: string;
  title: string;
  subtitle: string | null;
  location: string | null;
  hero_image_url: string | null;
  status: string;
};
type Offering = {
  id: string;
  project_id: string;
  offering_type: string;
  title: string;
  status: string;
};
type Opportunity = Project & { offerings: Offering[] };


function categoryFor(type: string): Category | null {
  if (type === "investment" || type === "sale") return "investments";
  if (type === "rental") return "rentals";
  if (type === "financing") return "capital";
  return null;
}

// These images already exist in public/properties. The three investment
// filenames match the image assets used by the individual project pages.
// A database hero_image_url can override the fallback for future updates.
const fallbackImages: Record<string, string> = {
  "villa-la-nucia": "/properties/villa-la-nucia/pool-mountain-view.webp",
  "marina-botafoch-apartment": "/properties/marina-botafoch-apartment/hero-living-kitchen.webp",
  "amsterdam-floraweg": "/properties/amsterdam-floraweg/hero-park-view.webp",
  "villa-can-juan-ibiza": "/properties/villa-can-juan-ibiza/vision-09.webp",
  "villa-des-coloms-ibiza": "/properties/villa-des-coloms-ibiza/vision-12.webp",
};

function imageFor(project: Project): string | null {
  // The overview only accepts site-local property assets as image sources.
  const configuredImage = project.hero_image_url?.trim();
  if (configuredImage?.startsWith("/properties/") && !configuredImage.includes("..")) {
    return configuredImage;
  }
  return fallbackImages[project.slug] ?? null;
}

function regionFor(project: Project, t: (key: string) => string): string {
  if (project.slug === "villa-la-nucia") return "COSTA BLANCA · SPAIN";
  if (project.slug === "marina-botafoch-apartment") return "IBIZA · SPAIN";
  return project.location || t("collection");
}

function offeringLabel(type: string, t: (key: string) => string): string {
  const labels: Record<string, string> = {
    rental: t("private_rental"),
    investment: t("investment"),
    sale: t("sale"),
    financing: t("capital_short"),
  };
  return labels[type] ?? type.replaceAll("_", " ");
}

export default function PrivatePage() {
  const router = useRouter();
  const t = useTranslations("Private");
  const locale = useLocale();
const categories: { id: Category; title: string; description?: string; shortTitle: string }[] = [
  {
    id: "rentals",
    title: t("rentals"),
    shortTitle: t("stays"),
  },
  {
    id: "investments",
    title: t("investments"),
    shortTitle: t("investments"),
    description: t("investment_description"),
  },
  {
    id: "capital",
    title: t("capital"),
    shortTitle: t("capital_short"),
    description: t("capital_description"),
  },
];

  const [viewState, setViewState] = useState<ViewState>("loading");
  const [name, setName] = useState("");
  const [role, setRole] = useState<MemberRole>("client");
  const [items, setItems] = useState<Opportunity[]>([]);
  const [capitalDossierCount, setCapitalDossierCount] = useState<number | null>(null);
  const [active, setActive] = useState<Category>("rentals");
  const [error, setError] = useState("");
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function load() {
      try {
        const supabase = createClient();
        const { data: auth, error: authError } = await supabase.auth.getUser();
        if (!mounted) return;
        if (authError || !auth.user) {
          window.location.replace(localizedPath("/login", locale));
          return;
        }

        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("role,is_active,full_name")
          .eq("id", auth.user.id)
          .single();
        if (!mounted) return;
        if (profileError || !profile) {
          setViewState("denied");
          return;
        }
        if (profile.role === "admin") {
          router.replace("/admin");
          return;
        }
        if (profile.role !== "client" && profile.role !== "partner") {
          setViewState("denied");
          return;
        }

        setRole(profile.role);
        setName(profile.full_name?.trim().split(/\s+/)[0] || "");
        if (profile.is_active !== true) {
          setViewState("pending");
          return;
        }

        // Capital dossiers are granted individually and are not financing project offerings.
        // Read the same protected endpoint used by the Capital dossier cards.
        void fetch("/api/capital-client-summary", { cache: "no-store" })
          .then(async (response) => {
            if (!response.ok) throw new Error("Capital summary unavailable");
            const payload: unknown = await response.json();
            const count = payload && typeof payload === "object" && "items" in payload &&
              Array.isArray(payload.items) ? payload.items.length : null;
            if (mounted) setCapitalDossierCount(count);
          })
          .catch(() => { if (mounted) setCapitalDossierCount(null); });

        // Both project AND offering grants must be present. Never display
        // an opportunity based on its project grant alone.
        const [projectGrants, offeringGrants] = await Promise.all([
          supabase.from("project_access").select("project_id").eq("user_id", auth.user.id),
          supabase.from("offering_access").select("offering_id").eq("user_id", auth.user.id),
        ]);
        if (!mounted) return;
        if (projectGrants.error || offeringGrants.error) {
          setError("permission_error");
          setViewState("error");
          return;
        }

        const projectIds = [...new Set((projectGrants.data ?? []).map((x) => x.project_id as string))];
        const offeringIds = [...new Set((offeringGrants.data ?? []).map((x) => x.offering_id as string))];
        if (!projectIds.length || !offeringIds.length) {
          setItems([]);
          setViewState("ready");
          return;
        }

        const [projectResult, offeringResult] = await Promise.all([
          supabase.from("projects")
            .select("id,slug,title,subtitle,location,hero_image_url,status")
            .in("id", projectIds).eq("status", "active"),
          supabase.from("offerings")
            .select("id,project_id,offering_type,title,status")
            .in("id", offeringIds).in("project_id", projectIds).eq("status", "active"),
        ]);
        if (!mounted) return;
        if (projectResult.error || offeringResult.error) {
          setError("opportunity_error");
          setViewState("error");
          return;
        }

        const offerings = (offeringResult.data ?? []) as Offering[];
        const visible = ((projectResult.data ?? []) as Project[])
          .map((project) => ({
            ...project,
            offerings: offerings.filter((offering) => offering.project_id === project.id),
          }))
          .filter((project) => project.offerings.length > 0)
          .sort((a, b) => a.title.localeCompare(b.title));

        setItems(visible);
        setViewState("ready");
      } catch {
        if (mounted) {
          setError("unavailable");
          setViewState("error");
        }
      }
    }

    void load();
    return () => { mounted = false; };
  }, [router, locale]);

  async function signOut() {
    if (signingOut) return;
    setSigningOut(true);
    const { error: signOutError } = await createClient().auth.signOut();
    if (signOutError) {
      setError("signout_error");
      setSigningOut(false);
      return;
    }
    window.location.replace(localizedPath("/", locale));
  }

  const groups = categories.map((category) => ({
    ...category,
    projects: items
      .map((project) => ({
        ...project,
        offerings: project.offerings.filter((offering) => categoryFor(offering.offering_type) === category.id),
      }))
      .filter((project) => project.offerings.length > 0),
  }));
  const selected = groups.find((group) => group.id === active)!;

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <a href={localizedPath("/", locale)} className={styles.brand} aria-label={t("home")}>
            <span className={styles.brandMzs}>MZS</span>
            <span className={styles.brandGroup}>GROUP</span>
          </a>
          <div className={styles.headerRight}>
            <span className={styles.accessLabel}>
              {role === "partner" ? t("partner") : t("client")}
            </span>
            {viewState === "ready" && (
              <>
                <Link className={styles.headerLink} href="/private/profile">
                  {t("profile")} <span aria-hidden="true"><ArrowUpRightIcon /></span>
                </Link>
                <Link className={styles.headerLink} href="/private/reservations">
                  {t("reservations")} <span aria-hidden="true"><ArrowUpRightIcon /></span>
                </Link>
              </>
            )}
            <LanguageSwitcher account />
            <button type="button" className={styles.signout} onClick={signOut} disabled={signingOut}>
              {signingOut ? t("signing_out") : t("signout")}
            </button>
          </div>
        </div>
      </header>

      <div className={styles.main}>
        <div className={styles.overline}>
          <span className={styles.overlineDot} aria-hidden="true" />
          {t("mzs_collection")} <span className={styles.overlineDivider}>/</span> {t("invitation")}
        </div>

        {viewState !== "ready" ? (
          <section className={styles.stateSection} role="status" aria-live="polite">
            <h1>
              {viewState === "loading" && t("preparing")}
              {viewState === "denied" && t("restricted")}
              {viewState === "pending" && t("pending")}
              {viewState === "error" && t("continue_error")}
            </h1>
            {viewState === "denied" && <p>{t("assistance")}</p>}
            {viewState === "pending" && <p>{t("activation")}</p>}
            {viewState === "error" && <p>{t(error)}</p>}
          </section>
        ) : (
          <>
            <section className={styles.welcome} aria-labelledby="private-welcome">
              <div className={styles.welcomeContent}>
                <p className={styles.welcomeKicker}>{t("personal")}</p>
                <h1 id="private-welcome">{t("welcome")} <em>{name || t("member")}</em></h1>
                <p className={styles.welcomeIntro}>
                  {t("intro")}
                </p>
              </div>
              <aside className={styles.welcomeAside} aria-label={t("overview")}>
                <span className={styles.asideKicker}>{t("access")}</span>
                <div className={styles.asideNumber}>{String(items.length)}</div>
                <p className={styles.asideDescription}>
                  {items.length === 1 ? t("property_one") : t("property_many")}
                </p>
                <span className={styles.asideLine} aria-hidden="true" />
                <p className={styles.asideNote}>{t("aside")}</p>
              </aside>
            </section>

            <RelationshipOverview />

            <section className={styles.collection} aria-labelledby="explore-heading">
              <div className={styles.collectionHeading}>
                <div>
                  <p className={styles.sectionKicker}>{t("the_collection")}</p>
                  <h2 id="explore-heading">{t("explore")}</h2>
                </div>
                <p className={styles.collectionHint}>{t("hint")}</p>
              </div>
              <div className={styles.categories} role="group" aria-label={t("categories")}>
                {groups.map((group, index) => (
                  <button
                    key={group.id}
                    type="button"
                    className={`${styles.category} ${active === group.id ? styles.categoryActive : ""}`}
                    aria-pressed={active === group.id}
                    onClick={() => setActive(group.id)}
                  >
                    <span className={styles.categoryTop}>
                      <span className={styles.categoryIndex}>{index + 1} / {group.shortTitle}</span>
                      <span className={styles.categoryArrow} aria-hidden="true"><ArrowUpRightIcon /></span>
                    </span>
                    <span className={styles.categoryBody}>
                      <span className={styles.categoryTitle}>{group.title}</span>
                      <span className={styles.categoryCount}>{String(group.id === "capital" ? (capitalDossierCount ?? "—") : group.projects.length)}</span>
                    </span>
                  </button>
                ))}
              </div>

              <div id="private-opportunities-panel" className={styles.opportunities} role="region" aria-live="polite" aria-label={t("opportunities_named", {title: selected.title})}>
                <div className={styles.opportunitiesHeading}>
                  <div>
                    <p className={styles.sectionKicker}>{t("exclusive")}</p>
                    <h2>{selected.title}<span className={styles.headingCount}> / {String(selected.id === "capital" ? (capitalDossierCount ?? "—") : selected.projects.length)}</span></h2>
                  </div>
                  {selected.description && <p>{selected.description}</p>}
                </div>

                {selected.projects.length === 0 ? (
                  active === "capital" ? null : (
                    <div className={styles.emptyState}>
                      <span className={styles.emptyMark} aria-hidden="true">✦</span>
                      <div>
                        <h3>{t("none")}</h3>
                        <p>{t("notify")}</p>
                      </div>
                    </div>
                  )
                ) : (
                  <div className={styles.properties}>
                    {selected.projects.map((project) => {
                      const picture = imageFor(project);
                      const href = `/private/projects/${encodeURIComponent(project.slug)}`;
                      return (
                        <article key={project.id} className={styles.property}>
                          {picture ? (
                            <Link href={href} className={styles.propertyPicture} aria-label={t("explore_named", {title: project.title})}>
                              <Image
                                src={picture}
                                alt={project.title}
                                fill
                                sizes="(max-width: 720px) 100vw, (max-width: 1050px) 50vw, 560px"
                                className={styles.propertyImage}
                              />
                              <span className={styles.photoCorner} aria-hidden="true">{t("mzs_collection")}</span>
                            </Link>
                          ) : (
                            <Link href={href} className={styles.propertyNoPicture} aria-label={t("explore_named", {title: project.title})}>
                              <span className={styles.noPictureMonogram} aria-hidden="true">MZS</span>
                              <span className={styles.photoCorner} aria-hidden="true">{t("private_opportunity")}</span>
                            </Link>
                          )}
                          <div className={styles.propertyDetails}>
                            <div className={styles.propertyTopline}>
                              <span>{regionFor(project, t)}</span>
                              <span>{t("private_access")}</span>
                            </div>
                            <h3><Link href={href}>{project.title}</Link></h3>
                            <p className={styles.propertySubtitle}>
                              {project.subtitle || t("subtitle")}
                            </p>
                            <div className={styles.offeringTags}>
                              {project.offerings.map((offering) => (
                                <span key={offering.id} className={styles.offeringTag}>
                                  {offeringLabel(offering.offering_type, t)}
                                </span>
                              ))}
                            </div>
                            <Link className={styles.propertyAction} href={href}>
                              {t("property")} <span aria-hidden="true"><ArrowUpRightIcon /></span>
                            </Link>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                )}
              </div>
              {active === "capital" && (
                <CapitalDossiers />
              )}
              {active === "capital" && <CapitalRequestForms />}
              {active === "capital" && selected.projects.length === 0 && (
                <div className={styles.emptyState}>
                  <span className={styles.emptyMark} aria-hidden="true">✦</span>
                  <div>
                    <h3>{t("none")}</h3>
                    <p>{t("notify")}</p>
                  </div>
                </div>
              )}
            </section>
          </>
        )}
        {error && viewState === "ready" && <p className={styles.notice} role="alert">{t(error)}</p>}
      </div>

      <footer className={styles.footer}>
        <div className={styles.footerInner}>
          <span>PRIVATE · INDEPENDENT · INTERNATIONAL</span>
          <span>{t("invitation")}</span>
        </div>
      </footer>
    </main>
  );
}
