import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import atmosphere from "./atmosphere.module.css";
import PublicHeader from "../components/PublicHeader";
import HomeContactFooter from "../components/HomeContactFooter";
import styles from "../public-introductions.module.css";
import IntroCallForm from "./IntroCallForm";
import { introCallsEnvironmentAllowed } from "../../lib/mzs/intro-calls";

export const metadata: Metadata = {
  title: "Private Capital | MZS Capital",
  description: "MZS Capital explores select private financing, investment and strategic partnership opportunities across real estate and businesses.",
  alternates: { canonical: "/private-capital" },
  openGraph: { title: "MZS Capital | Private Capital", description: "Independent capital. Private opportunities.", url: "/private-capital" },
  ...(process.env.VERCEL_ENV === "preview" ? { robots: { index: false, follow: false } } : {}),
};

const focus = [
  {
    number: "01",
    title: "Private Financing",
    subtitle: "Capital with perspective",
    description:
      "Considering privately structured financing opportunities, including real estate-backed lending, corporate finance and selected debt transactions.",
  },
  {
    number: "02",
    title: "Private Investments",
    subtitle: "Selected opportunities",
    description:
      "Exploring private investment opportunities in real estate, businesses, participations and other alternative assets.",
  },
  {
    number: "03",
    title: "Strategic Partnerships",
    subtitle: "Relationships that matter",
    description:
      "Working with selected parties on potential joint ventures and individually structured transactions built on a long-term perspective.",
  },
];

export default function PrivateCapitalPage() {
  const introCallEnabled = introCallsEnvironmentAllowed();
  const atmospherePreview = process.env.VERCEL_ENV === "preview" && introCallEnabled;
  return (
    <main className={`${styles.page} ${atmospherePreview ? atmosphere.page : ""}`}>
      <div className={styles.headerWrap}><PublicHeader /></div>
      <section className={`${styles.hero} ${atmospherePreview ? atmosphere.hero : ""}`} aria-labelledby="capital-heading">
        {atmospherePreview ? <div className={atmosphere.heroImage} aria-hidden="true"><Image src="/images/capital/mediterranean-light.webp" alt="" fill priority sizes="100vw" /><div className={atmosphere.heroShade} /></div> : <div className={styles.capitalImage} aria-hidden="true" />}
        <div className={styles.heroContent}>
          <p className={styles.eyebrow}>MZS CAPITAL / PRIVATE CAPITAL</p>
          <h1 id="capital-heading">Independent capital.<br /><em>Private opportunities.</em></h1>
          <div className={styles.rule} aria-hidden="true" />
          <p className={styles.heroLead}>
            A discreet and relationship-driven perspective on private financing,
            investment opportunities and strategic partnerships.
          </p>
          {atmospherePreview ? <nav className={atmosphere.sectionNavigation} aria-label="Explore Private Capital">
            <a href="#capital-perspective">Our Perspective <span aria-hidden="true">↗</span></a>
            <a href="#capital-focus">Our Focus <span aria-hidden="true">↗</span></a>
            <a href="#capital-method">Our Approach <span aria-hidden="true">↗</span></a>
            <a href="#introductory-call">Introductory Call <span aria-hidden="true">↗</span></a>
          </nav> : <div className={styles.heroActions}>
            {!atmospherePreview && (introCallEnabled ? (
              <a className={styles.primaryAction} href="#introductory-call">Request an introductory call <span aria-hidden="true">↗</span></a>
            ) : (
              <Link className={styles.primaryAction} href="/request-access">Request Private Access <span aria-hidden="true">↗</span></Link>
            ))}
            <a className={styles.quietAction} href="#capital-focus">Discover Our Focus <span aria-hidden="true">↓</span></a>
          </div>}
        </div>
        <p className={styles.heroSideNote}>PRIVATE. INDEPENDENT. INTERNATIONAL.</p>
      </section>

      <section id="capital-perspective" className={styles.introduction} aria-labelledby="capital-intro">
        <p className={styles.eyebrow}>OUR PERSPECTIVE / 01</p>
        <div className={styles.introColumns}>
          <h2 id="capital-intro">Capital guided by <em>relationships.</em></h2>
          <div className={styles.introBody}>
            <p>
              MZS Capital focuses on private investment and financing opportunities
              across real estate, businesses and selected alternative assets.
            </p>
            <p>
              Our independent approach includes both group-related initiatives
              and potential third-party transactions, considered on an individual basis.
            </p>
          </div>
        </div>
      </section>

      <section id="capital-focus" className={styles.activities} aria-labelledby="capital-activities">
        <div className={styles.sectionHeading}>
          <p className={styles.eyebrow}>OUR FOCUS / 02</p>
          <h2 id="capital-activities">Private by nature.</h2>
        </div>
        <div className={styles.activityGrid}>
          {focus.map((item) => (
            <article className={styles.activity} key={item.number}>
              <span className={styles.number}>{item.number}</span>
              <p className={styles.activitySubtitle}>{item.subtitle}</p>
              <h3>{item.title}</h3>
              <p>{item.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section id="capital-method" className={`${styles.presence} ${atmospherePreview ? atmosphere.approach : ""}`} aria-labelledby="capital-approach">
        {atmospherePreview && <figure className={atmosphere.conversationImage}><Image src="/images/capital/personal-conversation.webp" alt="An illustrative, sunlit setting for a private conversation, with linen armchairs and olive trees." fill sizes="(max-width: 850px) 100vw, 48vw" /><figcaption>SPACE FOR A PERSONAL PERSPECTIVE</figcaption></figure>}
        <div className={atmospherePreview ? atmosphere.approachCopy : atmosphere.unwrap}>
        <p className={styles.eyebrow}>OUR APPROACH / 03</p>
        <div>
          <h2 id="capital-approach">Discretion first.<br /><em>Independent thinking.</em></h2>
          <p>Every relationship, financing enquiry and opportunity is considered individually and confidentially.</p>
        </div>
        </div>
      </section>

      {introCallEnabled ? <IntroCallForm preview={process.env.VERCEL_ENV === "preview"} /> : <section className={styles.invitation} aria-labelledby="capital-invitation">
        <p className={styles.eyebrow}>SELECTED PRIVATE ACCESS</p>
        <h2 id="capital-invitation">A confidential conversation<br />starts here.</h2>
        <p>
          Authorized clients and partners can view selected opportunities and submit
          private capital enquiries within our secure platform.
        </p>
        <div className={styles.heroActions}>
          <Link className={styles.primaryAction} href="/login">Client & Partner Login <span aria-hidden="true">↗</span></Link>
          <Link className={styles.quietAction} href="/request-access">Request Access <span aria-hidden="true">↗</span></Link>
        </div>
        <p className={styles.disclaimer}>
          Information on this page is introductory only and does not constitute
          a public offer of securities, investment advice or a financing commitment.
        </p>
      </section>}
      {atmospherePreview && <p className={atmosphere.imageNote}>Illustrative atmosphere imagery.</p>}
      <div className={styles.bottomNavigation}>
        <Link href="/">← MZS Group</Link>
        <Link href="/real-estate">Explore Real Estate ↗</Link>
      </div>
      <div className={styles.footerWrap}><HomeContactFooter email="info@mzsgroup.eu" /></div>
    </main>
  );
}
