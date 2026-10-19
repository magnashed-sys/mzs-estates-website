import type { Metadata } from "next";
import Link from "next/link";
import PublicHeader from "../components/PublicHeader";
import HomeContactFooter from "../components/HomeContactFooter";
import styles from "../public-introductions.module.css";

export const metadata: Metadata = {
  title: "Real Estate | MZS Estates",
  description: "Discover the independent international real estate activities of MZS Estates: property ownership, private rentals, sales and development.",
  alternates: { canonical: "/real-estate" },
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
  return (
    <main className={styles.page}>
      <div className={styles.headerWrap}><PublicHeader /></div>
      <section className={styles.hero} aria-labelledby="estates-heading">
        <div className={styles.estateImage} aria-hidden="true" />
        <div className={styles.heroContent}>
          <p className={styles.eyebrow}>MZS ESTATES / REAL ESTATE</p>
          <h1 id="estates-heading">Private real estate.<br /><em>International perspective.</em></h1>
          <div className={styles.rule} aria-hidden="true" />
          <p className={styles.heroLead}>
            An independent approach to selected property ownership, management,
            private rentals, sales and real estate development.
          </p>
          <div className={styles.heroActions}>
            <Link className={styles.primaryAction} href="/request-access">Request Private Access <span aria-hidden="true">↗</span></Link>
            <a className={styles.quietAction} href="#activities">Explore Our Activities <span aria-hidden="true">↓</span></a>
          </div>
        </div>
        <p className={styles.heroSideNote}>PRIVATE. INDEPENDENT. INTERNATIONAL.</p>
      </section>

      <section className={styles.introduction} aria-labelledby="estates-intro">
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

      <section className={styles.presence} aria-labelledby="estates-presence">
        <p className={styles.eyebrow}>INTERNATIONAL REACH / 03</p>
        <div>
          <h2 id="estates-presence">Local knowledge.<br /><em>International outlook.</em></h2>
          <p>Selected activity across the Netherlands, Spain and the United Arab Emirates.</p>
        </div>
      </section>

      <section className={styles.invitation} aria-labelledby="estates-invitation">
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
      </section>

      <div className={styles.bottomNavigation}>
        <Link href="/">← MZS Group</Link>
        <Link href="/private-capital">Explore Private Capital ↗</Link>
      </div>
      <div className={styles.footerWrap}><HomeContactFooter email="info@mzsgroup.eu" /></div>
    </main>
  );
}
