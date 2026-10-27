import ArrowUpRightIcon from "../../../components/ArrowUpRightIcon";
import {getLocale, getTranslations} from "next-intl/server";
import Image from "next/image";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "../../../../lib/supabase/server";
import RentalCalendar from "./RentalCalendar";
import ConfiguredRentalCalendar from "./ConfiguredRentalCalendar";
import PropertyGallery, { type PropertyPhoto } from "./PropertyGallery";
import ProjectResources from "./ProjectResources";
import PropertyWalkthrough from "./PropertyWalkthrough";
import {nuciaVideoNotes} from "./nuciaVideoNotes";
import {localizedPhotoChapters} from "./localizedPhotoChapters";
import styles from "./propertyPresentation.module.css";
import VillaCanJuanInvestment from "./VillaCanJuanInvestment";
import VillaDesColomsInvestment from "./VillaDesColomsInvestment";
import AmsterdamFlorawegInvestment from "./AmsterdamFlorawegInvestment";
import { isPhase3aPreviewIsolated } from "../../../../lib/security/phase3a-preview-isolation";

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

export default async function PrivateProjectPage({ params }: Props) {
  const t = await getTranslations("ProjectUI");
  const privateT = await getTranslations("Private");
  const mapT = await getTranslations("MarinaMap");
  const locale = await getLocale();
  const villaPhotoChapters = localizedPhotoChapters(t, locale);
  const villaBase = "/properties/villa-la-nucia";
  const marinaBase = "/properties/marina-botafoch-apartment";

  // Labels refer to the photo contents, not the original (sometimes misleading)
  // filename. This allows the existing media files to remain untouched.
  const villaPhotos = Array.from(new Map(
    villaPhotoChapters.flatMap((chapter) => chapter.photos).map((photo) => [photo.src, photo]),
  ).values()).map((photo) => ({
    ...photo,
    caption: photo.retouched ? t("retouchedCaption", {caption: photo.caption}) : photo.caption,
  }));
  const villaHighlights = ["6883", "6845", "6852", "6865", "6877"];
  const villaGallery: PropertyPhoto[] = [
    ...villaHighlights.map((id) => villaPhotos.find((photo) => photo.src.endsWith(`/${id}.webp`))!),
    ...villaPhotos.filter((photo) => !villaHighlights.some((id) => photo.src.endsWith(`/${id}.webp`))),
  ];

  const marinaGallery: PropertyPhoto[] = [
    { src: `${marinaBase}/residence-pool.webp`, alt: t("p307"), caption: t("p308") },
    { src: `${marinaBase}/terrace-pool-view.webp`, alt: t("p311"), caption: t("p312") },
    { src: `${marinaBase}/hero-living-kitchen.webp`, alt: t("p313"), caption: t("p314") },
    { src: `${marinaBase}/building-exterior.webp`, alt: t("p315"), caption: t("p316") },
    { src: `${marinaBase}/bedroom-one.webp`, alt: t("p319"), caption: t("p320") },
    { src: `${marinaBase}/bedroom-view.webp`, alt: t("p321"), caption: t("p322") },
    { src: `${marinaBase}/residence-gym.webp`, alt: t("p327"), caption: t("p328") },
    { src: `${marinaBase}/underground-parking.webp`, alt: t("p329"), caption: t("p330") },
    { src: `${marinaBase}/building-entrance.webp`, alt: t("p331"), caption: t("p332") },
  ];

  const presentations: Record<string, Presentation> = {
    "villa-la-nucia": {
      label: t("p333"),
      destination: t("p334"),
      title: "Villa La Nucia",
      introduction: t("p336"),
      hero: `${villaBase}/2026-10/6883.webp`,
      heroAlt: t("p337"),
      facts: [
        { number: "04", label: t("p338") },
        { number: "03", label: t("p339") },
        { number: "08", label: t("p340") },
        { number: "01", label: t("p341") },
      ],
      gallery: villaGallery,
      storyKicker: t("p342"),
      storyTitle: t("p343"),
      storyParagraphs: [
        t("p344"),
        t("p345"),
      ],
      featuresTitle: t("p346"),
      features: [
        { number: "01", title: t("p347"), description: t("p348") },
        { number: "02", title: t("p349"), description: t("p350") },
        { number: "03", title: t("p351"), description: t("p352") },
      ],
      bookingKicker: t("p353"),
      bookingTitle: t("p354"),
      bookingIntro: t("p355"),
      locationHeading: t("p356"),
      locationDescription: t("p357"),
      locationDetail: t("p358"),
    },
    "marina-botafoch-apartment": {
      label: t("p359"),
      destination: t("p360"),
      title: privateT("marinaApartmentTitle"),
      introduction: t("p362"),
      hero: `${marinaBase}/hero-living-kitchen.webp`,
      heroAlt: t("p363"),
      facts: [
        { number: t("marinaBedroomsCount"), label: t("p338") },
        { number: t("marinaBathroomsCount"), label: t("p339") },
        { number: "4–6", label: t("p364") },
        { number: "1", label: t("p308") },
      ],
      gallery: marinaGallery,
      storyKicker: t("p365"),
      storyTitle: t("p366"),
      storyParagraphs: [
        t("p367"),
        t("p368"),
      ],
      featuresTitle: t("p369"),
      features: [
        { number: "01", title: t("p318"), description: t("p370") },
        { number: "02", title: t("p371"), description: t("p372") },
        { number: "03", title: t("p373"), description: t("p374") },
      ],
      bookingKicker: t("p375"),
      bookingTitle: t("p376"),
      bookingIntro: t("p377"),
      rentalOptions: [
        { title: t("p378"), price: "€400", details: t("twoBedroomDetails"), description: t("p379") },
        { title: t("p380"), price: "€600", details: t("threeBedroomDetails"), description: t("p381") },
      ],
      locationHeading: "Marina Botafoch, Ibiza.",
      locationDescription: t("p383"),
      locationDetail: t("p384"),
    },
  };


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
      !["client", "partner", "admin"].includes(profile.role)) notFound();

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
  const showStagingTestCalendar = process.env.VERCEL_ENV === "preview"
    && isPhase3aPreviewIsolated()
    && slug === "staging-test-residence"
    && property.id === "d14bb1c4-8fe7-46e5-b56c-bad717ff297d"
    && hasRental;
  const { data: contentRows, error: contentError } = await supabase
    .from("project_content").select("id,content,block_type,position")
    .eq("project_id", property.id).eq("block_type", "text")
    .eq("is_visible", true).order("position").order("created_at");
  if (contentError) notFound();
  // Render plain text only. React escapes it; never render raw HTML from the editor.
  const editorial = (contentRows ?? []).map(row => {
    const content = row.content && typeof row.content === "object" &&
      !Array.isArray(row.content) ? row.content as Record<string, unknown> : {};
    return {
      id: row.id as string,
      heading: typeof content.heading === "string" ? content.heading : "",
      body: typeof content.body === "string" ? content.body : "",
    };
  }).filter(row => row.heading && row.body);

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <a href={locale === "en" ? "/" : `/${locale}`} className={styles.brand} aria-label={t("p385")}>
          <span className={styles.brandMain}>MZS</span>
          <span className={styles.brandSub}>GROUP</span>
        </a>
        <Link href="/private" className={styles.headerBack}>{t("p388")}</Link>
      </header>

      {slug === "amsterdam-floraweg" ? (
        <AmsterdamFlorawegInvestment allowInvestment={visibleOfferings.some((o) => o.offering_type === "investment")} allowAcquisition={visibleOfferings.some((o) => o.offering_type === "sale")} />
      ) : slug === "villa-des-coloms-ibiza" ? (
        <VillaDesColomsInvestment />
      ) : slug === "villa-can-juan-ibiza" ? (
        <VillaCanJuanInvestment allowInvestment={visibleOfferings.some((o) => o.offering_type === "investment")} allowAcquisition={visibleOfferings.some((o) => o.offering_type === "sale")} />
      ) : presentation ? (
        <>
          <section className={styles.hero} aria-label={t("introduction", {title: presentation.title})}>
            <div className={styles.heroImage}>
              <Image src={presentation.hero} alt={presentation.heroAlt} fill priority sizes="100vw" className={styles.heroPhoto} />
            </div>
            <div className={styles.heroShade} aria-hidden="true" />
            <div className={styles.heroContent}>
              <p className={styles.kicker}>{presentation.label}</p>
              <h1>{presentation.title}</h1>
              <p className={styles.heroIntro}>{presentation.introduction}</p>
              <div className={styles.heroActions}>
                <a href="#availability" className={styles.primaryButton}>{t("p389")} <span aria-hidden="true"><ArrowUpRightIcon /></span></a>
                <a href="#gallery" className={styles.secondaryButton}>{t("p390")} <span aria-hidden="true">↓</span></a>
              </div>
            </div>
            <div className={styles.heroIndex} aria-hidden="true">{t("p391")}{presentation.destination}</div>
          </section>

          <nav className={styles.anchorNav} aria-label={t("p392")}>
            <span className={styles.anchorName}>{presentation.title}</span>
            <div className={styles.anchorLinks}>
              <a href="#gallery">{t("p393")}</a>
              {slug === "villa-la-nucia" && <a href="#walkthrough">{t("p394")}</a>}
              <a href="#experience">{t("p365")}</a>
              <a href="#stay">{t("p395")}</a>
              <a href="#availability" className={styles.anchorBook}>{t("p396")}</a>
            </div>
          </nav>

          <section className={styles.facts} aria-label={t("p397")}>
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
                <p className={styles.kicker}>{t("p398")}</p>
                <h2>{t("p399")}</h2>
              </div>
              <p className={styles.sectionAside}>{t("p400")}</p>
            </div>
            <PropertyGallery photos={presentation.gallery} title={presentation.title} />
          </section>

          {slug === "marina-botafoch-apartment" && (
            <section id="apartment-video" className={styles.marinaVideoSection} aria-labelledby="marina-apartment-video-heading">
              <div className={styles.marinaVideoIntro}>
                <p className={styles.kicker}>{t("marinaVideoKicker")}</p>
                <h2 id="marina-apartment-video-heading">{t("marinaVideoHeading")}</h2>
              </div>
              <div className={styles.marinaVideoPlayer}>
                <iframe
                  src="https://www.youtube-nocookie.com/embed/OhuBsCxEDYA?rel=0"
                  title={t("marinaVideoHeading")}
                  loading="lazy"
                  referrerPolicy="strict-origin-when-cross-origin"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                />
              </div>
              <a className={styles.marinaVideoLink}
                 href="https://youtu.be/OhuBsCxEDYA"
                 target="_blank" rel="noopener noreferrer">
                YouTube <span aria-hidden="true">↗</span>
              </a>
            </section>
          )}

          {slug === "villa-la-nucia" && (
            <section id="villa-video" className={styles.marinaVideoSection} aria-labelledby="villa-video-heading">
              <div className={styles.marinaVideoIntro}>
                <p className={styles.kicker}>MZS GROUP / 4K</p>
                <h2 id="villa-video-heading">Villa La Nucia</h2>
              </div>
              <div className={styles.marinaVideoPlayer}>
                <iframe
                  src="https://www.youtube-nocookie.com/embed/RzBYyb1pxGk?rel=0"
                  title="Villa La Nucia — 4K"
                  loading="lazy"
                  referrerPolicy="strict-origin-when-cross-origin"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                />
              </div>
              <a className={styles.marinaVideoLink}
                 href="https://youtu.be/RzBYyb1pxGk"
                 target="_blank" rel="noopener noreferrer">
                YouTube <span aria-hidden="true">↗</span>
              </a>
              <p className={styles.bodyCopy}>{nuciaVideoNotes[locale] || nuciaVideoNotes.en}</p>
            </section>
          )}

          {slug === "villa-la-nucia" && <PropertyWalkthrough />}

          <section id="experience" className={styles.storySection}>
            <div className={styles.storyCopy}>
              <p className={styles.kicker}>{presentation.storyKicker}</p>
              <h2>{presentation.storyTitle}</h2>
              {presentation.storyParagraphs.map((text) => (
                <p className={styles.bodyCopy} key={text}>{text}</p>
              ))}
              {slug === "villa-la-nucia" && (
                <p className={styles.disclaimer}>{t("p401")}</p>
              )}
            </div>
            <div className={styles.storyVisual}>
              <Image
                src={slug === "villa-la-nucia" ? `${villaBase}/2026-10/6845.webp` : `${marinaBase}/residence-pool.webp`}
                alt={slug === "villa-la-nucia" ? t("p402") : t("p403")}
                fill
                sizes="(max-width: 900px) 100vw, 44vw"
                className={styles.storyPhoto}
              />
              <span className={styles.photoCredit}>{slug === "villa-la-nucia" ? t("p404") : t("p405")}</span>
            </div>
          </section>

          <section className={styles.experienceSection}>
            <div className={styles.experienceHeading}>
              <p className={styles.kicker}>{t("p406")}</p>
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
                <span>{t("p407")}</span>
                <strong>€400</strong>
                <small>{t("p408")}</small>
                <a href="#availability">{t("p409")}</a>
              </div>
            </div>

            {presentation.rentalOptions ? (
              <div className={styles.rentalOptions}>
                {presentation.rentalOptions.map((option) => (
                  <article className={styles.rentalOption} key={option.title}>
                    <div className={styles.optionTop}>
                      <h3>{option.title}</h3>
                      <strong>{option.price}<span> {t("p410")}</span></strong>
                    </div>
                    <p className={styles.optionDetail}>{option.details}</p>
                    <p className={styles.optionNote}>{option.description}</p>
                    <a href="#availability">{t("p411")}</a>
                  </article>
                ))}
              </div>
            ) : (
              <div className={styles.villaNotes}>
                <span>{t("p412")}</span>
                <span>{t("p413")}</span>
                <span>{t("p414")}</span>
              </div>
            )}
          </section>

          <section id="availability" className={styles.calendarSection}>
            <div className={styles.calendarIntro}>
              <p className={styles.kicker}>{t("p415")}</p>
              <h2>{t("p162")}</h2>
              <p>{t("p416")}</p>
            </div>
            {/* Calendar presentation is localized; booking rules and API contracts are unchanged. */}
            {slug === "villa-la-nucia" ? (
              <RentalCalendar projectId={property.id} />
            ) : (
              <ConfiguredRentalCalendar projectId={property.id} />
            )}
          </section>

          <section className={styles.locationSection}>
            <div>
              <p className={styles.kicker}>{t("p417")}</p>
              <h2>{presentation.locationHeading}</h2>
              <p>{presentation.locationDescription}</p>
            </div>
            <div className={styles.locationInfo}>
              <span>{t("p418")}</span>
              <p>{presentation.locationDetail}</p>
              <a href="mailto:info@mzsgroup.eu?subject=MZS%20Private%20Collection%20%E2%80%94%20Property%20Enquiry">{t("p419")}</a>
            </div>
          </section>
          {slug === "marina-botafoch-apartment" && (
            <section className={styles.marinaMapSection} aria-labelledby="marina-map-heading">
              <div className={styles.marinaMapIntroduction}>
                <p className={styles.kicker}>MARINA BOTAFOCH / IBIZA</p>
                <h2 id="marina-map-heading">{mapT("heading")}</h2>
                <p>{mapT("intro")}</p>
              </div>
              <div className={styles.marinaMapLayout}>
                <div className={styles.marinaMapMain}>
                  <div className={styles.marinaMapFrame}>
                    <iframe
                      src="https://maps.google.com/maps?q=Marina%20Botafoch%20Ibiza&z=14&output=embed"
                      title="Marina Botafoch Ibiza neighbourhood map"
                      loading="lazy"
                      referrerPolicy="no-referrer-when-downgrade"
                      allowFullScreen
                    />
                  </div>
                  <p className={styles.marinaMapNote}>{mapT("note")}</p>
                  <a className={styles.marinaMapLink}
                    href="https://www.google.com/maps/search/?api=1&query=Marina%20Botafoch%20Ibiza"
                    target="_blank" rel="noopener noreferrer">
                    {mapT("open")} <span aria-hidden="true">↗</span>
                  </a>
                </div>
                <div className={styles.marinaNearby}>
                  <a href="https://www.google.com/maps/search/?api=1&query=Marina%20Botafoch%20Ibiza"
                     target="_blank" rel="noopener noreferrer" className={styles.marinaNearbyItem}>
                    <span className={styles.marinaNearbyIndex}>01 /</span>
                    <strong>Marina Botafoch</strong>
                    <span>{mapT("waterfront")}</span>
                  </a>
                  <a href="https://www.google.com/maps/search/?api=1&query=Talamanca%20Beach%20Ibiza"
                     target="_blank" rel="noopener noreferrer" className={styles.marinaNearbyItem}>
                    <span className={styles.marinaNearbyIndex}>02 /</span>
                    <strong>Talamanca Beach</strong>
                    <span>{mapT("beach")}</span>
                  </a>
                  <a href="https://www.google.com/maps/search/?api=1&query=Dalt%20Vila%20Ibiza"
                     target="_blank" rel="noopener noreferrer" className={styles.marinaNearbyItem}>
                    <span className={styles.marinaNearbyIndex}>03 /</span>
                    <strong>Dalt Vila</strong>
                    <span>{mapT("heritage")}</span>
                  </a>
                  <a href="https://www.google.com/maps/search/?api=1&query=Pacha%20Ibiza"
                     target="_blank" rel="noopener noreferrer" className={styles.marinaNearbyItem}>
                    <span className={styles.marinaNearbyIndex}>04 /</span>
                    <strong>Pacha Ibiza</strong>
                    <span>{mapT("nightlife")}</span>
                  </a>
                </div>
              </div>
            </section>
          )}
        </>
      ) : (
        <section className={styles.fallback}>
          <p className={styles.kicker}>{t("p420")}</p>
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

      <ProjectResources projectId={property.id} editorial={editorial} />

      {showStagingTestCalendar && (
        <section id="availability" className={styles.calendarSection}>
          <div className={styles.calendarIntro}>
            <p className={styles.kicker}>{t("p421")}</p>
            <h2>{t("p422")}</h2>
            <p>{t("p423")}</p>
          </div>
          <RentalCalendar projectId={property.id} />
        </section>
      )}

      <footer className={styles.footer}>
        <span>PRIVATE · INDEPENDENT · INTERNATIONAL</span>
        <a href="mailto:info@mzsgroup.eu">{t("p425")}</a>
        <Link href="/private">{t("p426")}</Link>
      </footer>
    </main>
  );
}

