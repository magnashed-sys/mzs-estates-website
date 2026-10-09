"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "../../lib/supabase/client";

type Category = "investments" | "rentals" | "capital";
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
type ViewState = "loading" | "ready" | "pending" | "denied" | "error";

const gold = "#d5c09a";
const muted = "#a9a398";
const edge = "#433b2f";
const categories: { id: Category; title: string; description: string }[] = [
  { id: "investments", title: "Investments", description: "Selected property and investment opportunities." },
  { id: "rentals", title: "Rental Properties", description: "Private stays available exclusively to your account." },
  { id: "capital", title: "Private Capital", description: "Selected private financing opportunities." },
];

function categoryFor(type: string): Category | null {
  if (type === "investment" || type === "sale") return "investments";
  if (type === "rental") return "rentals";
  if (type === "financing") return "capital";
  return null;
}

function imageFor(slug: string): string | null {
  if (slug === "villa-la-nucia") return "/properties/villa-la-nucia/pool-panorama.webp";
  if (slug === "marina-botafoch-apartment") return "/properties/marina-botafoch-apartment/hero-living-kitchen.webp";
  return null;
}

export default function PrivatePage() {
  const router = useRouter();
  const [state, setState] = useState<ViewState>("loading");
  const [name, setName] = useState("Member");
  const [role, setRole] = useState("client");
  const [items, setItems] = useState<Opportunity[]>([]);
  const [active, setActive] = useState<Category>("rentals");
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;
    async function load() {
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
        setState("denied");
        return;
      }
      if (profile.role === "admin") {
        router.replace("/admin");
        return;
      }
      if (!["client", "partner"].includes(profile.role)) {
        setState("denied");
        return;
      }
      setRole(profile.role);
      setName(profile.full_name?.trim().split(/\s+/)[0] || "Member");
      if (!profile.is_active) {
        setState("pending");
        return;
      }

      const [projectGrants, offeringGrants] = await Promise.all([
        supabase.from("project_access").select("project_id").eq("user_id", auth.user.id),
        supabase.from("offering_access").select("offering_id").eq("user_id", auth.user.id),
      ]);
      if (!mounted) return;
      if (projectGrants.error || offeringGrants.error) {
        setError("Unable to load your private permissions.");
        setState("error");
        return;
      }
      const projectIds = [...new Set((projectGrants.data ?? []).map((x) => x.project_id as string))];
      const offeringIds = [...new Set((offeringGrants.data ?? []).map((x) => x.offering_id as string))];
      if (!projectIds.length || !offeringIds.length) {
        setItems([]);
        setState("ready");
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
        setState("error");
        return;
      }
      const offerings = (offeringResult.data ?? []) as Offering[];
      const visible = ((projectResult.data ?? []) as Project[])
        .map((p) => ({ ...p, offerings: offerings.filter((o) => o.project_id === p.id) }))
        .filter((p) => p.offerings.length > 0);
      setItems(visible);
      setState("ready");
    }
    void load();
    return () => { mounted = false; };
  }, [router]);

  async function signOut() {
    await createClient().auth.signOut();
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
    <main style={{ minHeight: "100vh", background: "#0b0b0a", color: "#eeeae2", fontFamily: "Arial, Helvetica, sans-serif" }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 20, padding: "24px clamp(20px,5vw,80px)", borderBottom: `1px solid ${edge}`, flexWrap: "wrap" }}>
        <Link href="/" style={{ color: gold, textDecoration: "none", fontFamily: "Georgia, serif", fontSize: 23, letterSpacing: ".14em" }}>MZS GROUP</Link>
        <div style={{ display: "flex", gap: 20, alignItems: "center", flexWrap: "wrap" }}>
          <span style={{ color: muted, fontSize: 11, letterSpacing: ".13em", textTransform: "uppercase" }}>{role === "partner" ? "Partner Access" : "Private Client"}</span>
          <button type="button" onClick={signOut} style={{ background: "transparent", color: gold, border: `1px solid ${edge}`, padding: "11px 16px", cursor: "pointer", fontSize: 11, letterSpacing: ".1em" }}>SIGN OUT →</button>
        </div>
      </header>

      <section style={{ maxWidth: 1320, margin: "0 auto", padding: "clamp(45px,7vw,100px) clamp(20px,5vw,70px)" }}>
        <p style={{ color: gold, fontSize: 12, letterSpacing: ".23em" }}>BY INVITATION ONLY · MZS PRIVATE COLLECTION</p>
        {state === "loading" && <h1 style={heading}>Preparing your private collection...</h1>}
        {state === "denied" && <><h1 style={heading}>Access restricted.</h1><p style={{ color: muted }}>Please contact MZS Group.</p></>}
        {state === "pending" && <><h1 style={heading}>Access pending.</h1><p style={{ color: muted }}>Your private account is awaiting activation.</p></>}
        {state === "error" && <><h1 style={heading}>Unable to continue.</h1><p role="alert" style={{ color: muted }}>{error}</p></>}
        {state === "ready" && <>


<div
  style={{
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 24,
    flexWrap: "wrap",
  }}
>
  <h1 style={heading}>Welcome {name}</h1>

  <Link
    href="/private/reservations"
    style={{
      display: "inline-flex",
      alignItems: "center",
      color: gold,
      border: `1px solid ${edge}`,
      padding: "14px 20px",
      textDecoration: "none",
      fontSize: 12,
      letterSpacing: ".12em",
      whiteSpace: "nowrap",
    }}
  >
    MY RESERVATIONS →
  </Link>
</div>

          
          <p style={{ color: muted, lineHeight: 1.8, maxWidth: 690, marginBottom: 45 }}>Explore opportunities selected exclusively for your account. Choose a collection below to view your available properties and offerings.</p>

          <div role="tablist" aria-label="Private opportunity categories" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,230px),1fr))", gap: 16 }}>
            {groups.map((group) => (
              <button key={group.id} id={`tab-${group.id}`} type="button" role="tab" aria-selected={active === group.id} aria-controls="private-opportunities-panel" onClick={() => setActive(group.id)} style={{ textAlign: "left", background: active === group.id ? "#29251d" : "#151411", border: `1px solid ${active === group.id ? gold : edge}`, padding: "clamp(20px,3vw,30px)", minHeight: 164, color: "#eeeae2", cursor: "pointer" }}>
                <span style={{ display: "block", fontSize: 11, color: gold, letterSpacing: ".15em", marginBottom: 22, textTransform: "uppercase" }}>{group.title}</span>
                <span style={{ display: "block", fontFamily: "Georgia, serif", fontSize: 47, lineHeight: 1 }}>{group.projects.length}</span>
                <span style={{ display: "block", color: muted, fontSize: 12, marginTop: 12 }}>{group.projects.length === 1 ? "Selected opportunity" : "Selected opportunities"} {active === group.id ? "· Viewing" : "· View collection →"}</span>
              </button>
            ))}
          </div>

          <div id="private-opportunities-panel" role="tabpanel" aria-labelledby={`tab-${active}`} style={{ marginTop: 65 }}>
            <p style={{ color: gold, fontSize: 12, letterSpacing: ".2em" }}>YOUR PRIVATE COLLECTION</p>
            <h2 style={{ ...heading, fontSize: "clamp(32px,5vw,55px)", margin: "10px 0" }}>{selected.title} ({selected.projects.length})</h2>
            <p style={{ color: muted, lineHeight: 1.7, marginBottom: 30 }}>{selected.description}</p>
            {selected.projects.length === 0 ? (
              <div style={{ background: "#151411", border: `1px solid ${edge}`, padding: "35px clamp(20px,4vw,45px)" }}>
                <h3 style={{ fontFamily: "Georgia, serif", fontWeight: 400, fontSize: 25, margin: "0 0 12px" }}>No opportunities assigned yet.</h3>
                <p style={{ color: muted, lineHeight: 1.8, margin: 0 }}>Your relationship manager will notify you when selected opportunities become available.</p>
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,330px),1fr))", gap: 22 }}>
                {selected.projects.map((project) => {
                  const picture = active === "rentals" ? imageFor(project.slug) : null;
                  return (
                    <article key={project.id} style={{ border: `1px solid ${edge}`, background: "#151411", overflow: "hidden" }}>
                      {picture && <div style={{ position: "relative", aspectRatio: "16 / 10" }}><Image src={picture} alt={project.title} fill sizes="(max-width: 760px) 100vw, 50vw" style={{ objectFit: "cover" }} /></div>}
                      <div style={{ padding: 25 }}>
                        <p style={{ color: gold, fontSize: 11, letterSpacing: ".15em", textTransform: "uppercase" }}>{project.location || "Private Collection"}</p>
                        <h3 style={{ fontFamily: "Georgia, serif", fontWeight: 400, fontSize: 29, margin: "12px 0" }}>{project.title}</h3>
                        {project.subtitle && <p style={{ color: muted, lineHeight: 1.7 }}>{project.subtitle}</p>}
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", margin: "20px 0" }}>
                          {project.offerings.map((offering) => <span key={offering.id} style={{ border: `1px solid ${edge}`, color: gold, padding: "7px 10px", fontSize: 10, letterSpacing: ".09em" }}>{offering.offering_type === "rental" ? "PRIVATE RENTAL" : offering.offering_type.toUpperCase()}</span>)}
                        </div>
                        <Link href={`/private/projects/${encodeURIComponent(project.slug)}`} style={{ display: "inline-block", color: gold, borderTop: `1px solid ${edge}`, paddingTop: 18, textDecoration: "none", fontSize: 12, letterSpacing: ".13em" }}>VIEW PROPERTY →</Link>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        </>}
      </section>
      <footer style={{ borderTop: `1px solid ${edge}`, color: muted, padding: "28px clamp(20px,5vw,80px)", fontSize: 11, letterSpacing: ".13em" }}>PRIVATE. INDEPENDENT. INTERNATIONAL.</footer>
    </main>
  );
}

const heading: React.CSSProperties = {
  fontFamily: "Georgia, 'Times New Roman', serif",
  fontSize: "clamp(44px,7vw,85px)",
  fontWeight: 400,
  lineHeight: 1.1,
  margin: "20px 0 25px",
};
