import Image from "next/image";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "../../../../lib/supabase/server";
import RentalCalendar from "./RentalCalendar";
import ConfiguredRentalCalendar from "./ConfiguredRentalCalendar";
import PropertyGallery, { type PropertyPhoto } from "./PropertyGallery";
import styles from "./propertyPresentation.module.css";

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

type Fact = { number: string; label: string };
type Feature = { number: string; title: string; description: string };
type RentalOption = { title: string; price: string; details: string; description: string };
type Presentation = {
  label: string;
  destination: string;
  title: string;
  introduction: string;
  hero: string;
  heroAlt: string;
  facts: Fact[];
  gallery: PropertyPhoto[];
  storyKicker: string;
  storyTitle: string;
  storyParagraphs: string[];
  features: Feature[];
  featuresTitle: string;
  bookingKicker: string;
  bookingTitle: string;
  bookingIntro: string;
  rentalOptions?: RentalOption[];
  locationHeading: string;
  locationDescription: string;
  locationDetail: string;
};

const villaBase = "/properties/villa-la-nucia";
const marinaBase = "/properties/marina-botafoch-apartment";

// Labels refer to the photo contents, not the original (sometimes misleading)
// filename. This allows the existing media files to remain untouched.
const villaGallery: PropertyPhoto[] = [
  { src: `${villaBase}/pool-panorama.webp`, alt: "Private swimming pool, sun loungers and stone arches", caption: "The private pool" },
  { src: `${villaBase}/hero-pool.webp`, alt: "Main residence with open-plan dining and living room", caption: "Living & dining" },
  { src: `${villaBase}/pool-evening.webp`, alt: "The private swimming pool lit up in the evening", caption: "The pool after dark" },
  { src: `${villaBase}/living-dining.webp`, alt: "Dining table and lounge seating in the main residence", caption: "The main residence" },
  { src: `${villaBase}/pool-terrace.webp`, alt: "Shaded terrace overlooking the swimming pool and mountains", caption: "The outdoor terrace" },
  { src: `${villaBase}/pool-mountain-view.webp`, alt: "Main residence living room with seating and fireplace", caption: "Living room" },
  { src: `${villaBase}/kitchen.webp`, alt: "White fitted kitchen in the main residence", caption: "Kitchen" },
  { src: `${villaBase}/bedroom-double.webp`, alt: "Bedroom with a double bed", caption: "Double bedroom" },
  { src: `${villaBase}/bathroom-shower.webp`, alt: "Main residence walk-in shower", caption: "Bathroom" },
  { src: `${villaBase}/outdoor-shower.webp`, alt: "Outdoor shower near the swimming pool", caption: "Poolside shower" },
  { src: `${villaBase}/villa-front.webp`, alt: "Entrance to the private villa", caption: "Villa approach" },
  { src: `${villaBase}/private-entrance.webp`, alt: "Private terrace and entrance", caption: "Private entrance" },
  { src: `${villaBase}/living-room.webp`, alt: "Compact kitchenette beside the outdoor terrace", caption: "Indoor-outdoor kitchen" },
  { src: `${villaBase}/dining-room.webp`, alt: "Hallway and sideboard in the main residence", caption: "Interior details" },
  { src: `${villaBase}/bedroom-twin-setup.webp`, alt: "Exterior terrace beside the villa", caption: "Villa terrace" },
];

const marinaGallery: PropertyPhoto[] = [
  { src: `${marinaBase}/residence-pool.webp`, alt: "Swimming pool in the Marina Botafoch residential complex", caption: "Residence pool" },
  { src: `${marinaBase}/living-terrace.webp`, alt: "Bright living room opening onto the terrace", caption: "Living & terrace" },
  { src: `${marinaBase}/terrace-pool-view.webp`, alt: "Private terrace overlooking the neighbourhood and pool", caption: "Views from the terrace" },
  { src: `${marinaBase}/hero-living-kitchen.webp`, alt: "Contemporary fitted kitchen and living space", caption: "Contemporary kitchen" },
  { src: `${marinaBase}/building-exterior.webp`, alt: "Exterior of the Marina Botafoch residence", caption: "The residence" },
  { src: `${marinaBase}/private-terrace.webp`, alt: "Terrace doors and exterior seating area", caption: "Private terrace" },
  { src: `${marinaBase}/bedroom-one.webp`, alt: "Light double bedroom with a window", caption: "Bedroom" },
  { src: `${marinaBase}/bedroom-view.webp`, alt: "View from a bedroom window", caption: "Bedroom view" },
  { src: `${marinaBase}/bathroom-two.webp`, alt: "Contemporary bathroom with shower", caption: "Bathroom" },
  { src: `${marinaBase}/bathroom-detail.webp`, alt: "Bathroom detail in the apartment", caption: "Bathroom details" },
  { src: `${marinaBase}/residence-gym.webp`, alt: "Shared gym with fitness machines", caption: "Residence gym" },
  { src: `${marinaBase}/underground-parking.webp`, alt: "Underground car parking area", caption: "Parking" },
  { src: `${marinaBase}/building-entrance.webp`, alt: "Entrance to the Benizamid 8 residence", caption: "Residence entrance" },
];

const presentations: Record<string, Presentation> = {
  "villa-la-nucia": {
    label: "COSTA BLANCA · PRIVATE RENTAL",
    destination: "La Nucía · Costa Blanca, Spain",
    title: "Villa La Nucia",
    introduction: "A Mediterranean hideaway made for unhurried days, private gatherings and the freedom to unwind.",
    hero: `${villaBase}/pool-terrace.webp`,
    heroAlt: "Villa La Nucia shaded terrace overlooking the swimming pool and mountains",
    facts: [
      { number: "04", label: "Bedrooms" },
      { number: "03", label: "Bathrooms" },
      { number: "08", label: "Maximum guests*" },
      { number: "01", label: "Private pool" },
    ],
    gallery: villaGallery,
    storyKicker: "THE VILLA",
    storyTitle: "Together, with space to make it your own.",
    storyParagraphs: [
      "Set around a private pool and spacious terraces, Villa La Nucia balances an easy-going Mediterranean atmosphere with the privacy of separate living spaces.",
      "The main residence has two double bedrooms, a bathroom, an inviting lounge and dining area, and a kitchen. Two independent guest accommodations each provide a double bedroom and their own bathroom — ideal for those who appreciate being together without sharing every moment.",
    ],
    featuresTitle: "The art of staying together, privately.",
    features: [
      { number: "01", title: "Main residence", description: "Two double bedrooms, a bathroom, living and dining space, and a fitted kitchen." },
      { number: "02", title: "Guest accommodation", description: "Two independent guest spaces, each with a double bedroom and private bathroom. Separate interior photographs will be added when available." },
      { number: "03", title: "Outdoors, all day", description: "A private swimming pool, sun terraces and an outdoor shower, with a quieter atmosphere after dark." },
    ],
    bookingKicker: "PRIVATE RENTAL",
    bookingTitle: "Stay a little longer.",
    bookingIntro: "Entire villa from €400 per night, with a minimum stay of seven nights. Optional pool heating is available at €50 per day. Arrival and departure preferences can be included in your request; every booking is personally reviewed by MZS Group.",
    locationHeading: "Your place on the Costa Blanca.",
    locationDescription: "Enjoy the Costa Blanca's mountain scenery and Mediterranean towns from a private base in La Nucía.",
    locationDetail: "Carrer Serra del Ferrer 3 · 03530 La Nucía · Alicante, Spain",
  },
  "marina-botafoch-apartment": {
    label: "IBIZA · PRIVATE RENTAL",
    destination: "Marina Botafoch · Ibiza, Spain",
    title: "Marina Botafoch Apartment",
    introduction: "A contemporary private residence, where bright interiors, a personal terrace and Ibiza's marina lifestyle come together.",
    hero: `${marinaBase}/hero-living-kitchen.webp`,
    heroAlt: "Sunlit kitchen and living area of Marina Botafoch Apartment",
    facts: [
      { number: "02–03", label: "Bedrooms" },
      { number: "01–02", label: "Bathrooms" },
      { number: "04–06", label: "Guests" },
      { number: "01", label: "Residence pool" },
    ],
    gallery: marinaGallery,
    storyKicker: "THE RESIDENCE",
    storyTitle: "A quiet address, moments from the marina.",
    storyParagraphs: [
      "Step inside a light-filled apartment with an open living space, contemporary kitchen and private terrace. Its position within the Marina Botafoch area offers a comfortable starting point for an Ibiza stay.",
      "The residential complex provides a swimming pool, fitness area and dedicated parking. Inside, the apartment can be reserved in either a two-bedroom or full three-bedroom configuration — always as a private, exclusive-use stay.",
    ],
    featuresTitle: "The ease of a private Ibiza residence.",
    features: [
      { number: "01", title: "Private terrace", description: "An extension of the living space, ideal for taking time outside without leaving home." },
      { number: "02", title: "Residence amenities", description: "Access to the shared residence swimming pool, fitness room and a dedicated parking space." },
      { number: "03", title: "Flexible configuration", description: "Choose two or three bedrooms. Both options refer to the same apartment and share one availability calendar." },
    ],
    bookingKicker: "YOUR IBIZA STAY",
    bookingTitle: "Choose how you stay.",
    bookingIntro: "Both options offer exclusive use of the apartment for a minimum of seven nights. Select the configuration in the live calendar below to request your preferred dates.",
    rentalOptions: [
      { title: "Two-bedroom residence", price: "€400", details: "2 bedrooms · 1 bathroom · Up to 4 guests", description: "Third bedroom and second bathroom remain closed." },
      { title: "Three-bedroom residence", price: "€600", details: "3 bedrooms · 2 bathrooms · Up to 6 guests", description: "Full apartment configuration, for a larger party." },
    ],
    locationHeading: "Marina Botafoch, Ibiza.",
    locationDescription: "An appealing contemporary address with the marina, the waterfront and Ibiza Town within reach.",
    locationDetail: "Carrer de Benizamid 8, apartment 17 · 07800 Eivissa · Ibiza, Spain",
  },
};

export default async function PrivateProjectPage({ params }: Props) {
  const { slug } = await params;
  const supabase = await createClient();
  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError || !auth.user) redirect("/login?role=client");

  // Keep the same existing security checks; never expose property detail to
  // someone without both project and offering access.
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
  const hasRental = visibleOfferings.some((o) => o.offering_type === "rental");
  const presentation = hasRental ? presentations[slug] : undefined;

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <Link href="/" className={styles.brand} aria-label="MZS Group — homepage">
          <span className={styles.brandMain}>MZS</span>
          <span className={styles.brandSub}>GROUP</span>
        </Link>
        <Link href="/private" className={styles.headerBack}>← BACK TO PRIVATE COLLECTION</Link>
      </header>

      {presentation ? (
        <>
          <section className={styles.hero} aria-label={`${presentation.title} introduction`}>
            <div className={styles.heroImage}>
              <Image src={presentation.hero} alt={presentation.heroAlt} fill priority sizes="100vw" className={styles.heroPhoto} />
            </div>
            <div className={styles.heroShade} aria-hidden="true" />
            <div className={styles.heroContent}>
              <p className={styles.kicker}>{presentation.label}</p>
              <h1>{presentation.title}</h1>
              <p className={styles.heroIntro}>{presentation.introduction}</p>
              <div className={styles.heroActions}>
                <a href="#availability" className={styles.primaryButton}>CHECK AVAILABILITY <span aria-hidden="true">↗</span></a>
                <a href="#gallery" className={styles.secondaryButton}>EXPLORE THE PROPERTY <span aria-hidden="true">↓</span></a>
              </div>
            </div>
            <div className={styles.heroIndex} aria-hidden="true">MZS PRIVATE COLLECTION&nbsp; / &nbsp;{presentation.destination}</div>
          </section>

          <nav className={styles.anchorNav} aria-label="Explore this property">
            <span className={styles.anchorName}>{presentation.title}</span>
            <div className={styles.anchorLinks}>
              <a href="#gallery">PHOTOGRAPHY</a>
              <a href="#experience">THE RESIDENCE</a>
              <a href="#stay">THE STAY</a>
              <a href="#availability" className={styles.anchorBook}>CHECK DATES ↗</a>
            </div>
          </nav>

          <section className={styles.facts} aria-label="Property highlights">
            {presentation.facts.map((fact) => (
              <div className={styles.fact} key={fact.label}>
                <span className={styles.factNumber}>{fact.number}</span>
                <span className={styles.factLabel}>{fact.label}</span>
              </div>
            ))}
          </section>

          <section id="gallery" className={styles.gallerySection}>
            <div className={styles.sectionHeader}>
              <div>
                <p className={styles.kicker}>THE PRIVATE COLLECTION</p>
                <h2>A closer look.</h2>
              </div>
              <p className={styles.sectionAside}>A considered selection of photographs of the property and its surroundings.</p>
            </div>
            <PropertyGallery photos={presentation.gallery} title={presentation.title} />
          </section>

          <section id="experience" className={styles.storySection}>
            <div className={styles.storyCopy}>
              <p className={styles.kicker}>{presentation.storyKicker}</p>
              <h2>{presentation.storyTitle}</h2>
              {presentation.storyParagraphs.map((text) => (
                <p className={styles.bodyCopy} key={text}>{text}</p>
              ))}
              {slug === "villa-la-nucia" && (
                <p className={styles.disclaimer}>*Maximum occupancy is subject to confirmation of permitted rental use.</p>
              )}
            </div>
            <div className={styles.storyVisual}>
              <Image
                src={slug === "villa-la-nucia" ? `${villaBase}/living-dining.webp` : `${marinaBase}/residence-pool.webp`}
                alt={slug === "villa-la-nucia" ? "Villa La Nucia main residence interior" : "Shared pool at Marina Botafoch residence"}
                fill
                sizes="(max-width: 900px) 100vw, 44vw"
                className={styles.storyPhoto}
              />
              <span className={styles.photoCredit}>{slug === "villa-la-nucia" ? "THE MAIN RESIDENCE" : "RESIDENCE AMENITIES"}</span>
            </div>
          </section>

          <section className={styles.experienceSection}>
            <div className={styles.experienceHeading}>
              <p className={styles.kicker}>THE EXPERIENCE</p>
              <h2>{presentation.featuresTitle}</h2>
            </div>
            <div className={styles.experienceGrid}>
              {presentation.features.map((feature) => (
                <article className={styles.experienceItem} key={feature.number}>
                  <span className={styles.featureNumber}>{feature.number}</span>
                  <h3>{feature.title}</h3>
                  <p>{feature.description}</p>
                </article>
              ))}
            </div>
          </section>

          <section id="stay" className={styles.staySection}>
            <div className={styles.stayTop}>
              <div>
                <p className={styles.kicker}>{presentation.bookingKicker}</p>
                <h2>{presentation.bookingTitle}</h2>
                <p className={styles.bodyCopy}>{presentation.bookingIntro}</p>
              </div>
              <div className={styles.stayPrice}>
                <span>FROM</span>
                <strong>€400</strong>
                <small>PER NIGHT · MINIMUM 7 NIGHTS</small>
                <a href="#availability">SELECT YOUR DATES ↗</a>
              </div>
            </div>

            {presentation.rentalOptions ? (
              <div className={styles.rentalOptions}>
                {presentation.rentalOptions.map((option) => (
                  <article className={styles.rentalOption} key={option.title}>
                    <div className={styles.optionTop}>
                      <h3>{option.title}</h3>
                      <strong>{option.price}<span> / night</span></strong>
                    </div>
                    <p className={styles.optionDetail}>{option.details}</p>
                    <p className={styles.optionNote}>{option.description}</p>
                    <a href="#availability">CHECK THIS STAY ↗</a>
                  </article>
                ))}
              </div>
            ) : (
              <div className={styles.villaNotes}>
                <span>ENTIRE VILLA · EXCLUSIVE USE</span>
                <span>POOL HEATING: €50 / DAY (OPTIONAL)</span>
                <span>PERSONAL APPROVAL FOR EVERY REQUEST</span>
              </div>
            )}
          </section>

          <section id="availability" className={styles.calendarSection}>
            <div className={styles.calendarIntro}>
              <p className={styles.kicker}>PERSONAL BOOKING REQUEST</p>
              <h2>Plan your stay.</h2>
              <p>Select your preferred dates below. Your request is reviewed individually by MZS Group.</p>
            </div>
            {/* Existing tested booking components: left entirely unchanged. */}
            {slug === "villa-la-nucia" ? (
              <RentalCalendar projectId={property.id} />
            ) : (
              <ConfiguredRentalCalendar projectId={property.id} />
            )}
          </section>

          <section className={styles.locationSection}>
            <div>
              <p className={styles.kicker}>LOCATION & SURROUNDINGS</p>
              <h2>{presentation.locationHeading}</h2>
              <p>{presentation.locationDescription}</p>
            </div>
            <div className={styles.locationInfo}>
              <span>THE ADDRESS</span>
              <p>{presentation.locationDetail}</p>
              <a href="mailto:info@mzsgroup.eu?subject=MZS%20Private%20Collection%20%E2%80%94%20Property%20Enquiry">ENQUIRE PRIVATELY ↗</a>
            </div>
          </section>
        </>
      ) : (
        <section className={styles.fallback}>
          <p className={styles.kicker}>MZS PRIVATE COLLECTION</p>
          <h1>{property.title}</h1>
          {property.subtitle && <p>{property.subtitle}</p>}
          {property.location && <p>{property.location}</p>}
          <div className={styles.otherOfferings}>
            {visibleOfferings.map((offering) => (
              <article key={offering.id}>
                <h2>{offering.title ?? offering.offering_type}</h2>
                {offering.summary && <p>{offering.summary}</p>}
              </article>
            ))}
          </div>
        </section>
      )}

      <footer className={styles.footer}>
        <span>PRIVATE · INDEPENDENT · INTERNATIONAL</span>
        <a href="mailto:info@mzsgroup.eu">CONTACT MZS ↗</a>
        <Link href="/private">BACK TO PRIVATE COLLECTION →</Link>
      </footer>
    </main>
  );
}
