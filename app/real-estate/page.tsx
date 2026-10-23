import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import IntroCallForm from "../private-capital/IntroCallForm";
import atmosphere from "../private-capital/atmosphere.module.css";
import estate from "./atmosphere.module.css";
import PublicHeader from "../components/PublicHeader";
import HomeContactFooter from "../components/HomeContactFooter";
import styles from "../public-introductions.module.css";

export const metadata: Metadata = {
  title: "Real Estate | MZS Estates",
  description: "Discover the independent international real estate activities of MZS Estates: property ownership, private rentals, sales and development.",
  alternates: { canonical: "/real-estate" },
  ...(process.env.VERCEL_ENV === "preview" ? { robots: { index: false, follow: false } } : {}),
  openGraph: { title: "MZS Estates | Real Estate", description: "Private real estate. International perspective.", url: "/real-estate" },
};

const activities = [
  {
    number: "01",
    title: "Ownership & Management",
    subtitle: "An enduring perspective",
    description:
      "Managing selected privately and corporately held real estate with a considered approach to quality, continuity and long-term value.",
  },
  {
    number: "02",
    title: "Private Rentals & Sales",
    subtitle: "A personal approach",
    description:
      "Presenting selected residential properties for private rental or acquisition, with discretion and personal attention throughout.",
  },
  {
    number: "03",
    title: "Development & Investment",
    subtitle: "Opportunities with purpose",
    description:
      "Evaluating development projects and strategic real estate opportunities in carefully selected international markets.",
  },
];

export default function RealEstatePage() {
  const preview = process.env.VERCEL_ENV === "preview" && process.env.NEXT_PUBLIC_SUPABASE_URL === "https://senonkpxdtlhyhrubicg.supabase.co";
  return (
    <main className={`${styles.page} ${preview ? atmosphere.page : ""}`}>
      <div className={styles.headerWrap}><PublicHeader /></div>
      <section className={`${styles.hero} ${preview ? atmosphere.hero : ""}`} aria-labelledby="estates-heading">
        {preview ? <div className={atmosphere.heroImage} aria-hidden="true"><Image src="/mzs-hero.png" alt="" fill priority sizes="100vw" /><div className={atmosphere.heroShade} /></div> : <div className={styles.estateImage} aria-hidden="true" />}
        <div className={styles.heroContent}>
          <p className={styles.eyebrow}>MZS ESTATES / REAL ESTATE</p>
          <h1 id="estates-heading">Private real estate.<br /><em>International perspective.</em></h1>
          <div className={styles.rule} aria-hidden="true" />
          <p className={styles.heroLead}>
            An independent approach to selected property ownership, management,
            private rentals, sales and real estate development.
          </p>
          {preview ? <nav className={atmosphere.sectionNavigation} aria-label="Explore Real Estate">
            <a href="#estates-perspective">Our Perspective <span aria-hidden="true">↗</span></a>
            <a href="#activities">Our Activities <span aria-hidden="true">↗</span></a>
            <a href="#international-reach">International Reach <span aria-hidden="true">↗</span></a>
            <a href="#introductory-call">Introductory Call <span aria-hidden="true">↗</span></a>
          </nav> : <div className={styles.heroActions}>
            <Link className={styles.primaryAction} href="/request-access">Request Private Access <span aria-hidden="true">↗</span></Link>
            <a className={styles.quietAction} href="#activities">Explore Our Activities <span aria-hidden="true">↓</span></a>
          </div>}
        </div>
        <p className={styles.heroSideNote}>PRIVATE. INDEPENDENT. INTERNATIONAL.</p>
      </section>

      <section id="estates-perspective" className={styles.introduction} aria-labelledby="estates-intro">
        <p className={styles.eyebrow}>OUR PERSPECTIVE / 01</p>
        <div className={styles.introColumns}>
          <h2 id="estates-intro">Real estate, with <em>a long-term view.</em></h2>
          <div className={styles.introBody}>
            <p>
              MZS Estates is an independent international real estate company focused on
              the acquisition, ownership, management and development of selected properties.
            </p>
            <p>
              Our activities encompass residential and investment real estate across
              carefully selected markets, combining local perspective with a personal,
              long-term approach.
            </p>
          </div>
        </div>
      </section>

      <section id="activities" className={styles.activities} aria-labelledby="estates-activities">
        <div className={styles.sectionHeading}>
          <p className={styles.eyebrow}>WHAT WE DO / 02</p>
          <h2 id="estates-activities">Our activities.</h2>
        </div>
        <div className={styles.activityGrid}>
          {activities.map((item) => (
            <article className={styles.activity} key={item.number}>
              <span className={styles.number}>{item.number}</span>
              <p className={styles.activitySubtitle}>{item.subtitle}</p>
              <h3>{item.title}</h3>
              <p>{item.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section id="international-reach" className={`${styles.presence} ${preview ? atmosphere.approach : ""}`} aria-labelledby="estates-presence">
        {preview && <figure className={atmosphere.conversationImage}><Image src="/images/capital/mediterranean-light.webp" alt="Illustrative Mediterranean stone architecture overlooking the sea at sunset." fill sizes="(max-width: 850px) 100vw, 50vw" /><figcaption>A SENSE OF PLACE. A LONG-TERM PERSPECTIVE.</figcaption></figure>}
        <div className={preview ? atmosphere.approachCopy : atmosphere.unwrap}>
        <p className={styles.eyebrow}>INTERNATIONAL REACH / 03</p>
        <div>
          <h2 id="estates-presence">Local knowledge.<br /><em>International outlook.</em></h2>
          <p>Selected activity across the Netherlands, Spain and the United Arab Emirates.</p>
          {preview && <p className={estate.regions}>THE NETHERLANDS · SPAIN · UAE</p>}
        </div>
        </div>
      </section>

      {preview ? <IntroCallForm preview source="real-estate" sectionNumber="04" /> : <section className={styles.invitation} aria-labelledby="estates-invitation">
        <p className={styles.eyebrow}>PERSONAL & CONFIDENTIAL</p>
        <h2 id="estates-invitation">A more private way<br />to explore property.</h2>
        <p>
          Detailed presentations and selected opportunities are shared with authorized
          clients and partners through our secure private platform.
        </p>
        <div className={styles.heroActions}>
          <Link className={styles.primaryAction} href="/login">Client & Partner Login <span aria-hidden="true">↗</span></Link>
          <Link className={styles.quietAction} href="/request-access">Request Access <span aria-hidden="true">↗</span></Link>
        </div>
      </section>}
      {preview && <p className={atmosphere.imageNote}>Illustrative atmosphere imagery.</p>}

      <div className={styles.bottomNavigation}>
        <Link href="/">← MZS Group</Link>
        <Link href="/private-capital">Explore Private Capital ↗</Link>
      </div>
      <div className={styles.footerWrap}><HomeContactFooter email="info@mzsgroup.eu" /></div>
    </main>
  );
}
