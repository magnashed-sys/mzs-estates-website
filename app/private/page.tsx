"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "../../lib/supabase/client";
import styles from "./privateDashboard.module.css";

type Category = "rentals" | "investments" | "capital";
type ViewState = "loading" | "ready" | "pending" | "denied" | "error";
type MemberRole = "client" | "partner";

type Project = {
  id: string;
  slug: string;
  title: string;
  subtitle: string | null;
  location: string | null;
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

const categories: { id: Category; title: string; description: string; shortTitle: string }[] = [
  {
    id: "rentals",
    title: "Rental Properties",
    shortTitle: "Private stays",
    description: "Private residences available exclusively to your account.",
  },
  {
    id: "investments",
    title: "Investments",
    shortTitle: "Investments",
    description: "Selected property and investment opportunities.",
  },
  {
    id: "capital",
    title: "Private Capital",
    shortTitle: "Private capital",
    description: "Individually selected private financing opportunities.",
  },
];

function categoryFor(type: string): Category | null {
  if (type === "investment" || type === "sale") return "investments";
  if (type === "rental") return "rentals";
  if (type === "financing") return "capital";
  return null;
}

// Images are already public assets in this MZS project; no new assets required.
function imageFor(slug: string): string | null {
  if (slug === "villa-la-nucia") return "/properties/villa-la-nucia/pool-mountain-view.webp";
  if (slug === "marina-botafoch-apartment") return "/properties/marina-botafoch-apartment/hero-living-kitchen.webp";
  return null;
}

function regionFor(project: Project): string {
  if (project.slug === "villa-la-nucia") return "COSTA BLANCA · SPAIN";
  if (project.slug === "marina-botafoch-apartment") return "IBIZA · SPAIN";
  return project.location || "PRIVATE COLLECTION";
}

function offeringLabel(type: string): string {
  const labels: Record<string, string> = {
    rental: "Private rental",
    investment: "Investment",
    sale: "Private sale",
    financing: "Private capital",
  };
  return labels[type] ?? type.replaceAll("_", " ");
}

export default function PrivatePage() {
  const router = useRouter();
  const [viewState, setViewState] = useState<ViewState>("loading");
  const [name, setName] = useState("Member");
  const [role, setRole] = useState<MemberRole>("client");
  const [items, setItems] = useState<Opportunity[]>([]);
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
          router.replace("/login?role=client");
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
        setName(profile.full_name?.trim().split(/\s+/)[0] || "Member");
        if (profile.is_active !== true) {
          setViewState("pending");
          return;
        }

        // Both project AND offering grants must be present. Never display
        // an opportunity based on its project grant alone.
        const [projectGrants, offeringGrants] = await Promise.all([
          supabase.from("project_access").select("project_id").eq("user_id", auth.user.id),
          supabase.from("offering_access").select("offering_id").eq("user_id", auth.user.id),
        ]);
        if (!mounted) return;
        if (projectGrants.error || offeringGrants.error) {
          setError("Unable to load your private permissions.");
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
            .select("id,slug,title,subtitle,location,status")
            .in("id", projectIds).eq("status", "active"),
          supabase.from("offerings")
            .select("id,project_id,offering_type,title,status")
            .in("id", offeringIds).in("project_id", projectIds).eq("status", "active"),
        ]);
        if (!mounted) return;
        if (projectResult.error || offeringResult.error) {
          setError("Unable to load your selected opportunities.");
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
          setError("Your collection is temporarily unavailable. Please try again.");
          setViewState("error");
        }
      }
    }

    void load();
    return () => { mounted = false; };
  }, [router]);

  async function signOut() {
    if (signingOut) return;
    setSigningOut(true);
    const { error: signOutError } = await createClient().auth.signOut();
    if (signOutError) {
      setError("Unable to sign out right now. Please try again.");
      setSigningOut(false);
      return;
    }
    router.replace("/");
    router.refresh();
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
          <Link href="/" className={styles.brand} aria-label="MZS Group — Home">
            <span className={styles.brandMzs}>MZS</span>
            <span className={styles.brandGroup}>GROUP</span>
          </Link>
          <div className={styles.headerRight}>
            <span className={styles.accessLabel}>
              {role === "partner" ? "PARTNER ACCESS" : "PRIVATE CLIENT"}
            </span>
            {viewState === "ready" && (
              <Link className={styles.headerLink} href="/private/reservations">
                My Reservations <span aria-hidden="true">↗</span>
              </Link>
            )}
            <button type="button" className={styles.signout} onClick={signOut} disabled={signingOut}>
              {signingOut ? "Signing out…" : "Sign out"}
            </button>
          </div>
        </div>
      </header>

      <div className={styles.main}>
        <div className={styles.overline}>
          <span className={styles.overlineDot} aria-hidden="true" />
          MZS PRIVATE COLLECTION <span className={styles.overlineDivider}>/</span> BY INVITATION ONLY
        </div>

        {viewState !== "ready" ? (
          <section className={styles.stateSection} role="status" aria-live="polite">
            <h1>
              {viewState === "loading" && "Preparing your private collection…"}
              {viewState === "denied" && "Access restricted."}
              {viewState === "pending" && "Access pending."}
              {viewState === "error" && "Unable to continue."}
            </h1>
            {viewState === "denied" && <p>Please contact MZS Group for assistance.</p>}
            {viewState === "pending" && <p>Your private account is awaiting activation.</p>}
            {viewState === "error" && <p>{error}</p>}
          </section>
        ) : (
          <>
            <section className={styles.welcome} aria-labelledby="private-welcome">
              <div className={styles.welcomeContent}>
                <p className={styles.welcomeKicker}>YOUR PERSONAL COLLECTION</p>
                <h1 id="private-welcome">Welcome <em>{name}.</em></h1>
                <p className={styles.welcomeIntro}>
                  Discover a carefully selected collection of private residences, investments and opportunities,
                  reserved exclusively for your account.
                </p>
              </div>
              <aside className={styles.welcomeAside} aria-label="Collection overview">
                <span className={styles.asideKicker}>YOUR PRIVATE ACCESS</span>
                <div className={styles.asideNumber}>{items.length.toString().padStart(2, "0")}</div>
                <p className={styles.asideDescription}>
                  {items.length === 1 ? "Personally selected property" : "Personally selected properties"}
                </p>
                <span className={styles.asideLine} aria-hidden="true" />
                <p className={styles.asideNote}>Personal. Confidential. By invitation only.</p>
              </aside>
            </section>

            <section className={styles.collection} aria-labelledby="explore-heading">
              <div className={styles.collectionHeading}>
                <div>
                  <p className={styles.sectionKicker}>THE PRIVATE COLLECTION</p>
                  <h2 id="explore-heading">Explore your opportunities.</h2>
                </div>
                <p className={styles.collectionHint}>Select a category to view the opportunities available to you.</p>
              </div>
              <div className={styles.categories} role="group" aria-label="Opportunity categories">
                {groups.map((group, index) => (
                  <button
                    key={group.id}
                    type="button"
                    className={`${styles.category} ${active === group.id ? styles.categoryActive : ""}`}
                    aria-pressed={active === group.id}
                    onClick={() => setActive(group.id)}
                  >
                    <span className={styles.categoryTop}>
                      <span className={styles.categoryIndex}>0{index + 1} / {group.shortTitle}</span>
                      <span className={styles.categoryArrow} aria-hidden="true">↗</span>
                    </span>
                    <span className={styles.categoryBody}>
                      <span className={styles.categoryTitle}>{group.title}</span>
                      <span className={styles.categoryCount}>{String(group.projects.length).padStart(2, "0")}</span>
                    </span>
                  </button>
                ))}
              </div>

              <div id="private-opportunities-panel" className={styles.opportunities} role="region" aria-live="polite" aria-label={`${selected.title} opportunities`}>
                <div className={styles.opportunitiesHeading}>
                  <div>
                    <p className={styles.sectionKicker}>SELECTED EXCLUSIVELY FOR YOU</p>
                    <h2>{selected.title}<span className={styles.headingCount}> / {String(selected.projects.length).padStart(2, "0")}</span></h2>
                  </div>
                  <p>{selected.description}</p>
                </div>

                {selected.projects.length === 0 ? (
                  <div className={styles.emptyState}>
                    <span className={styles.emptyMark} aria-hidden="true">✦</span>
                    <div>
                      <h3>No opportunities assigned yet.</h3>
                      <p>Your MZS relationship manager will notify you when selected opportunities become available.</p>
                    </div>
                  </div>
                ) : (
                  <div className={styles.properties}>
                    {selected.projects.map((project) => {
                      const picture = imageFor(project.slug);
                      const href = `/private/projects/${encodeURIComponent(project.slug)}`;
                      return (
                        <article key={project.id} className={styles.property}>
                          {picture ? (
                            <Link href={href} className={styles.propertyPicture} aria-label={`Explore ${project.title}`}>
                              <Image
                                src={picture}
                                alt={project.title}
                                fill
                                sizes="(max-width: 720px) 100vw, (max-width: 1050px) 50vw, 560px"
                                className={styles.propertyImage}
                              />
                              <span className={styles.photoCorner} aria-hidden="true">MZS PRIVATE COLLECTION</span>
                            </Link>
                          ) : (
                            <Link href={href} className={styles.propertyNoPicture} aria-label={`Explore ${project.title}`}>
                              <span className={styles.noPictureMonogram} aria-hidden="true">MZS</span>
                              <span className={styles.photoCorner} aria-hidden="true">PRIVATE OPPORTUNITY</span>
                            </Link>
                          )}
                          <div className={styles.propertyDetails}>
                            <div className={styles.propertyTopline}>
                              <span>{regionFor(project)}</span>
                              <span>PRIVATE ACCESS</span>
                            </div>
                            <h3><Link href={href}>{project.title}</Link></h3>
                            <p className={styles.propertySubtitle}>
                              {project.subtitle || "Privately selected for your MZS account."}
                            </p>
                            <div className={styles.offeringTags}>
                              {project.offerings.map((offering) => (
                                <span key={offering.id} className={styles.offeringTag}>
                                  {offeringLabel(offering.offering_type)}
                                </span>
                              ))}
                            </div>
                            <Link className={styles.propertyAction} href={href}>
                              Explore property <span aria-hidden="true">↗</span>
                            </Link>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                )}
              </div>
            </section>
          </>
        )}
        {error && viewState === "ready" && <p className={styles.notice} role="alert">{error}</p>}
      </div>

      <footer className={styles.footer}>
        <div className={styles.footerInner}>
          <span>PRIVATE · INDEPENDENT · INTERNATIONAL</span>
          <span>BY INVITATION ONLY</span>
        </div>
      </footer>
    </main>
  );
}
