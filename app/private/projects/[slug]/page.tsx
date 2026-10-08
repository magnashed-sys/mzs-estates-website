import Image from "next/image";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "../../../../lib/supabase/server";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };
type Project = {
  id: string;
  slug: string;
  title: string;
  subtitle: string | null;
  location: string | null;
  hero_image_url: string | null;
};
type Offering = {
  id: string;
  title: string | null;
  offering_type: string;
  summary: string | null;
};

const base = "/properties/villa-la-nucia";
const gallery = [
  { file: "pool-panorama.webp", label: "Private pool and outdoor terraces" },
  { file: "pool-mountain-view.webp", label: "Pool and mountain views" },
  { file: "living-room.webp", label: "Main residence · living room" },
  { file: "living-dining.webp", label: "Main residence · open living and dining" },
  { file: "kitchen.webp", label: "Main residence · kitchen" },
  { file: "dining-room.webp", label: "Main residence · dining room" },
  { file: "bedroom-double.webp", label: "Main residence · double bedroom" },
  { file: "bedroom-twin-setup.webp", label: "Main residence · bedroom with double-bed configuration" },
  { file: "bathroom-shower.webp", label: "Main residence · bathroom" },
  { file: "pool-terrace.webp", label: "Pool terrace" },
  { file: "outdoor-shower.webp", label: "Outdoor shower" },
  { file: "pool-evening.webp", label: "Pool at night" },
];

const tag: React.CSSProperties = {
  border: "1px solid #675b48",
  color: "#d5c09a",
  padding: "9px 13px",
  letterSpacing: "0.12em",
  fontSize: 11,
  textTransform: "uppercase",
};
const gold = "#d5c09a";
const muted = "#a7a29a";
const sectionTitle: React.CSSProperties = {
  fontFamily: "Georgia, 'Times New Roman', serif",
  fontWeight: 400,
  fontSize: "clamp(32px, 5vw, 60px)",
  lineHeight: 1.12,
  margin: "14px 0 24px",
};

export default async function PrivateProjectPage({ params }: Props) {
  const { slug } = await params;
  const supabase = await createClient();
  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError || !auth.user) redirect("/login?role=client");

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role,is_active")
    .eq("id", auth.user.id)
    .single();
  if (profileError || !profile || profile.is_active !== true ||
      !["client", "partner"].includes(profile.role)) notFound();

  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("id,slug,title,subtitle,location,hero_image_url")
    .eq("slug", slug)
    .eq("status", "active")
    .maybeSingle();
  if (projectError || !project) notFound();
  const property = project as Project;

  const { data: projectGrant, error: projectGrantError } = await supabase
    .from("project_access")
    .select("project_id")
    .eq("project_id", property.id)
    .eq("user_id", auth.user.id)
    .maybeSingle();
  if (projectGrantError || !projectGrant) notFound();

  const { data: grants, error: grantsError } = await supabase
    .from("offering_access")
    .select("offering_id")
    .eq("user_id", auth.user.id);
  if (grantsError) notFound();
  const offeringIds = (grants ?? []).map((g) => g.offering_id as string);
  if (!offeringIds.length) notFound();

  const { data: offerings, error: offeringError } = await supabase
    .from("offerings")
    .select("id,title,offering_type,summary")
    .eq("project_id", property.id)
    .eq("status", "active")
    .in("id", offeringIds);
  if (offeringError || !offerings?.length) notFound();
  const visibleOfferings = offerings as Offering[];
  const isVilla = slug === "villa-la-nucia";
  const hasRental = visibleOfferings.some((o) => o.offering_type === "rental");

  return (
    <main style={{ background: "#0b0b0a", color: "#eeeae2", minHeight: "100vh", fontFamily: "Arial, Helvetica, sans-serif" }}>
      <header style={{ padding: "25px clamp(22px,5vw,80px)", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 20, borderBottom: "1px solid #34302b" }}>
        <Link href="/" style={{ fontFamily: "Georgia, serif", fontSize: 22, letterSpacing: "0.13em", color: gold, textDecoration: "none" }}>MZS GROUP</Link>
        <Link href="/private" style={{ color: gold, textDecoration: "none", fontSize: 11, letterSpacing: "0.13em", textAlign: "right" }}>← PRIVATE COLLECTION</Link>
      </header>

      {isVilla && hasRental ? (
        <>
          <section style={{ position: "relative", minHeight: "min(76vh,760px)", display: "flex", alignItems: "end", isolation: "isolate" }}>
            <Image src={`${base}/hero-pool.webp`} alt="Villa La Nucia swimming pool and Mediterranean terrace" fill priority sizes="100vw" style={{ objectFit: "cover", zIndex: -2 }} />
            <div style={{ position: "absolute", inset: 0, background: "linear-gradient(0deg,rgba(0,0,0,.86),rgba(0,0,0,.05) 70%)", zIndex: -1 }} />
            <div style={{ padding: "clamp(35px,7vw,100px)", maxWidth: 1000 }}>
              <p style={{ color: gold, letterSpacing: "0.25em", fontSize: 12 }}>MZS PRIVATE COLLECTION · COSTA BLANCA</p>
              <h1 style={{ fontFamily: "Georgia, serif", fontWeight: 400, fontSize: "clamp(54px,9vw,124px)", lineHeight: 1, margin: "20px 0" }}>Villa La Nucia</h1>
              <p style={{ fontSize: 18, lineHeight: 1.65, maxWidth: 650 }}>A private Mediterranean retreat with independent guest accommodation, a swimming pool and mountain views.</p>
              <a href="#gallery" style={{ display: "inline-block", marginTop: 20, padding: "15px 25px", background: gold, color: "#10100e", textDecoration: "none", fontSize: 12, letterSpacing: ".12em" }}>EXPLORE THE VILLA ↓</a>
            </div>
          </section>

          <section style={{ padding: "60px clamp(22px,7vw,110px)", borderBottom: "1px solid #34302b" }}>
            <p style={{ color: gold, letterSpacing: ".22em", fontSize: 12 }}>THE PROPERTY</p>
            <h2 style={sectionTitle}>Space to be together. Privacy to unwind.</h2>
            <p style={{ color: muted, lineHeight: 1.9, fontSize: 16, maxWidth: 830 }}>Villa La Nucia combines a welcoming main residence with two separate guest accommodations. The main house offers two double bedrooms, one bathroom, a comfortable living and dining area, and a kitchen. One independent guest accommodation is situated near the main entrance; the other is located near the pool at the rear. Each has a double bedroom and its own bathroom.</p>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 30 }}>
              <span style={tag}>4 bedrooms</span><span style={tag}>3 bathrooms</span><span style={tag}>Up to 8 guests*</span><span style={tag}>Private pool</span><span style={tag}>2 separate guest accommodations</span>
            </div>
            <p style={{ color: muted, fontSize: 12, marginTop: 20 }}>*Subject to confirmation of permitted rental occupancy.</p>
          </section>

          <section id="gallery" style={{ padding: "80px clamp(22px,7vw,110px)" }}>
            <p style={{ color: gold, fontSize: 12, letterSpacing: ".22em" }}>EXPLORE THE VILLA</p>
            <h2 style={sectionTitle}>A closer look.</h2>
            <p style={{ color: muted, lineHeight: 1.7, maxWidth: 800, marginBottom: 32 }}>The interior photographs below show the main residence. Photographs of the two independent guest accommodations will be added separately.</p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,310px),1fr))", gap: 16 }}>
              {gallery.map((photo) => (
                <figure key={photo.file} style={{ margin: 0, background: "#171613" }}>
                  <div style={{ position: "relative", aspectRatio: "4/3" }}>
                    <Image src={`${base}/${photo.file}`} alt={photo.label} fill sizes="(max-width: 720px) 100vw, 50vw" style={{ objectFit: "cover" }} />
                  </div>
                  <figcaption style={{ padding: "14px 16px", fontSize: 12, color: muted, letterSpacing: ".04em" }}>{photo.label}</figcaption>
                </figure>
              ))}
            </div>
          </section>

          <section style={{ padding: "65px clamp(22px,7vw,110px)", background: "#151411" }}>
            <p style={{ color: gold, fontSize: 12, letterSpacing: ".22em" }}>PRIVATE RENTAL</p>
            <h2 style={sectionTitle}>Your stay, your pace.</h2>
            <div style={{ display: "flex", gap: "28px 70px", flexWrap: "wrap", margin: "30px 0" }}>
              <div><div style={{ fontFamily: "Georgia, serif", fontSize: 44 }}>€400</div><div style={{ color: muted, fontSize: 13 }}>Per night · entire villa</div></div>
              <div><div style={{ fontFamily: "Georgia, serif", fontSize: 44 }}>7</div><div style={{ color: muted, fontSize: 13 }}>Minimum nights</div></div>
              <div><div style={{ fontFamily: "Georgia, serif", fontSize: 44 }}>€50</div><div style={{ color: muted, fontSize: 13 }}>Optional pool heating per day</div></div>
            </div>
            <p style={{ color: muted, lineHeight: 1.8, maxWidth: 760 }}>Flexible arrival and departure days. Guests may request preferred check-in and check-out times. All bookings require personal approval by MZS Group. The live availability calendar and booking requests will be introduced in the next release.</p>
          </section>

          <section style={{ padding: "70px clamp(22px,7vw,110px)" }}>
            <p style={{ color: gold, fontSize: 12, letterSpacing: ".22em" }}>LOCATION & SURROUNDINGS</p>
            <h2 style={sectionTitle}>La Nucía, Costa Blanca.</h2>
            <p style={{ color: muted, lineHeight: 1.9 }}>Carrer Serra del Ferrer 3, 03530 La Nucía, Alicante, Spain.</p>
            <p style={{ color: muted, lineHeight: 1.9, maxWidth: 760 }}>Discover the Costa Blanca, with mountain scenery, Mediterranean coastal towns and inviting outdoor experiences. An interactive location guide will follow.</p>
          </section>
        </>
      ) : (
        <section style={{ padding: "100px clamp(22px,7vw,110px)", maxWidth: 1000 }}>
          <p style={{ color: gold, fontSize: 12, letterSpacing: ".2em" }}>MZS PRIVATE COLLECTION</p>
          <h1 style={sectionTitle}>{property.title}</h1>
          <p style={{ color: muted, lineHeight: 1.8 }}>{property.subtitle}</p>
          <p style={{ color: gold, marginTop: 20 }}>{property.location}</p>
          <div style={{ marginTop: 60 }}>
            {visibleOfferings.map((o) => (
              <article key={o.id} style={{ padding: "25px 0", borderTop: "1px solid #34302b" }}>
                <h2 style={{ fontFamily: "Georgia, serif", fontWeight: 400 }}>{o.title ?? o.offering_type}</h2>
                <p style={{ color: muted, lineHeight: 1.7 }}>{o.summary}</p>
              </article>
            ))}
          </div>
        </section>
      )}
      <footer style={{ borderTop: "1px solid #34302b", padding: "28px clamp(22px,5vw,80px)", display: "flex", justifyContent: "space-between", gap: 20, flexWrap: "wrap", color: muted, fontSize: 11, letterSpacing: ".13em" }}>
        <span>PRIVATE. INDEPENDENT. INTERNATIONAL.</span><Link href="/private" style={{ color: gold, textDecoration: "none" }}>BACK TO PRIVATE DASHBOARD →</Link>
      </footer>
    </main>
  );
}
