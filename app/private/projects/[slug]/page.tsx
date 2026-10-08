import Image from "next/image";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "../../../../lib/supabase/server";
import RentalCalendar from "./RentalCalendar";

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

const featuredPhotos = [
  { file: "pool-panorama.webp", label: "Private swimming pool" },
  { file: "pool-mountain-view.webp", label: "Mountain views" },
  { file: "living-room.webp", label: "Main residence · lounge" },
  { file: "living-dining.webp", label: "Main residence · living and dining" },
  { file: "kitchen.webp", label: "Main residence · kitchen" },
  { file: "bedroom-double.webp", label: "Main residence · bedroom" },
];

const photoCard: React.CSSProperties = {
  margin: 0,
  background: "#171613",
  minWidth: 0,
};

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
          <section style={{ position: "relative", minHeight: "min(88vh,880px)", display: "flex", alignItems: "end", isolation: "isolate" }}>
            <Image src={`${base}/pool-panorama.webp`} alt="Villa La Nucia swimming pool and Mediterranean terrace" fill priority sizes="100vw" style={{ objectFit: "cover", zIndex: -2 }} />
            <div style={{ position: "absolute", inset: 0, background: "linear-gradient(90deg,rgba(0,0,0,.64),rgba(0,0,0,.08) 75%),linear-gradient(0deg,rgba(0,0,0,.68),transparent 70%)", zIndex: -1 }} />
            <div style={{ padding: "clamp(35px,7vw,100px)", maxWidth: 1000 }}>
              <p style={{ color: gold, letterSpacing: "0.25em", fontSize: 12 }}>MZS PRIVATE COLLECTION · COSTA BLANCA</p>
              <h1 style={{ fontFamily: "Georgia, serif", fontWeight: 400, fontSize: "clamp(54px,9vw,124px)", lineHeight: 1, margin: "20px 0" }}>Villa La Nucia</h1>
              <p style={{ fontSize: 18, lineHeight: 1.65, maxWidth: 650 }}>A private Mediterranean retreat with independent guest accommodation, a swimming pool and mountain views.</p>
              <a href="#gallery" style={{ display: "inline-block", marginTop: 20, padding: "15px 25px", background: gold, color: "#10100e", textDecoration: "none", fontSize: 12, letterSpacing: ".12em" }}>EXPLORE THE VILLA ↓</a>
            </div>
          </section>

          <section style={{ padding: "clamp(65px,9vw,130px) clamp(22px,7vw,110px)", borderBottom: "1px solid #34302b" }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,420px),1fr))", gap: "clamp(30px,6vw,90px)", alignItems: "center" }}>
              <div>
                <p style={{ color: gold, letterSpacing: ".22em", fontSize: 12 }}>THE PROPERTY</p>
                <h2 style={sectionTitle}>Space to be together. Privacy to unwind.</h2>
                <p style={{ color: muted, lineHeight: 1.9, fontSize: 16 }}>Villa La Nucia combines a welcoming main residence with two separate guest accommodations. The main house offers two double bedrooms, one bathroom, a comfortable living and dining area, and a kitchen.</p>
                <p style={{ color: muted, lineHeight: 1.9, fontSize: 16 }}>One independent guest accommodation is situated near the main entrance; the other is located near the pool at the rear. Each has a double bedroom and its own bathroom.</p>
                <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 30 }}>
                  <span style={tag}>4 bedrooms</span><span style={tag}>3 bathrooms</span><span style={tag}>Up to 8 guests*</span><span style={tag}>Private pool</span>
                </div>
                <p style={{ color: muted, fontSize: 12, marginTop: 20 }}>*Subject to confirmation of permitted rental occupancy.</p>
              </div>
              <div style={{ position: "relative", aspectRatio: "4 / 5", minHeight: 320 }}>
                <Image src={`${base}/living-dining.webp`} alt="Living and dining area in the main residence" fill sizes="(max-width: 850px) 100vw, 45vw" style={{ objectFit: "cover" }} />
              </div>
            </div>
          </section>

          <section id="gallery" style={{ padding: "clamp(65px,8vw,110px) clamp(22px,7vw,110px)" }}>
            <p style={{ color: gold, fontSize: 12, letterSpacing: ".22em" }}>EXPLORE THE VILLA</p>
            <h2 style={sectionTitle}>A closer look.</h2>
            <p style={{ color: muted, lineHeight: 1.7, maxWidth: 800, marginBottom: 36 }}>Discover the main residence and its outdoor spaces. Interior photographs of the two independent guest accommodations will be added separately.</p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,340px),1fr))", gap: 18 }}>
              {featuredPhotos.map((photo) => (
                <figure key={photo.file} style={photoCard}>
                  <div style={{ position: "relative", aspectRatio: "4/3" }}>
                    <Image src={`${base}/${photo.file}`} alt={photo.label} fill sizes="(max-width: 760px) 100vw, 45vw" style={{ objectFit: "cover" }} />
                  </div>
                  <figcaption style={{ padding: "15px 18px", fontSize: 12, color: muted }}>{photo.label}</figcaption>
                </figure>
              ))}
            </div>
            <details style={{ marginTop: 38, borderTop: "1px solid #34302b", paddingTop: 26 }}>
              <summary style={{ display: "inline-block", cursor: "pointer", border: `1px solid ${gold}`, padding: "17px 28px", color: gold, fontSize: 12, letterSpacing: ".14em", listStyle: "none" }}>VIEW ALL PHOTOS ↓</summary>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,290px),1fr))", gap: 16, marginTop: 32 }}>
                {gallery.map((photo) => (
                  <figure key={photo.file} style={photoCard}>
                    <div style={{ position: "relative", aspectRatio: "4/3" }}>
                      <Image src={`${base}/${photo.file}`} alt={photo.label} fill sizes="(max-width: 760px) 100vw, 33vw" style={{ objectFit: "cover" }} />
                    </div>
                    <figcaption style={{ padding: "13px 15px", fontSize: 12, color: muted }}>{photo.label}</figcaption>
                  </figure>
                ))}
              </div>
            </details>
          </section>

          <section style={{ padding: "70px clamp(22px,7vw,110px)", borderTop: "1px solid #34302b" }}>
            <p style={{ color: gold, fontSize: 12, letterSpacing: ".22em" }}>PRIVATE ACCOMMODATION</p>
            <h2 style={sectionTitle}>Together, with room for privacy.</h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,270px),1fr))", gap: 20 }}>
              {[
                ["THE MAIN RESIDENCE", "Two double bedrooms, one bathroom, living and dining room, and kitchen."],
                ["GUEST ACCOMMODATION 01", "Independent accommodation near the main entrance, with a double bedroom and private bathroom."],
                ["GUEST ACCOMMODATION 02", "Independent accommodation beside the pool at the rear, with a double bedroom and private bathroom."],
              ].map(([heading, description]) => (
                <article key={heading} style={{ borderTop: `1px solid ${gold}`, paddingTop: 22 }}>
                  <h3 style={{ fontSize: 12, color: gold, letterSpacing: ".15em", fontWeight: 400 }}>{heading}</h3>
                  <p style={{ color: muted, lineHeight: 1.8, fontSize: 15 }}>{description}</p>
                </article>
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

<section
  id="availability"
  style={{
    padding: "60px clamp(22px,7vw,110px)",
    background: "#0b0b0a",
  }}
>
  <RentalCalendar projectId={property.id} />
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
