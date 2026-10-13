import Image from "next/image";
import PropertyGallery, { type PropertyPhoto } from "./PropertyGallery";
import styles from "./villaCanJuanInvestment.module.css";

const base = "/properties/villa-can-juan-ibiza";
const visionCaptions = [
  "Open-air bathroom concept", "Kitchen concept", "Primary bedroom concept", "Garden shower concept",
  "Living and dining concept", "Cinema room concept", "Living room and fireplace concept",
  "Exterior terrace concept", "Landscape and entrance concept", "Outdoor bathing concept",
  "Pool and terrace concept", "Poolside entertaining concept", "Pool at dusk concept",
  "Estate and garden concept", "Garden courtyard concept", "Private outdoor lounge concept",
  "Stone façade and landscape concept", "Shaded dining terrace concept",
];
const progressCaptions = [
  "Pool construction", "Existing stone structure · aerial view", "Restoration works · aerial view",
  "Stone structure and site works", "Existing structure · overhead view",
];
const vision: PropertyPhoto[] = visionCaptions.map((caption, i) => ({
  src: `${base}/vision-${String(i + 1).padStart(2, "0")}.webp`, alt: caption, caption,
}));
const progress: PropertyPhoto[] = progressCaptions.map((caption, i) => ({
  src: `${base}/progress-${String(i + 1).padStart(2, "0")}.webp`, alt: caption, caption,
}));

const enquiry = (kind: "investment" | "acquisition") => {
  const subject = kind === "investment"
    ? "Villa Can Juan Ibiza — Investment Enquiry"
    : "Villa Can Juan Ibiza — Acquisition Enquiry";
  const body = kind === "investment"
    ? "Dear MZS Group,\n\nI would like to receive information about participation in Villa Can Juan Ibiza.\n\nName:\nTelephone:\n\nKind regards,"
    : "Dear MZS Group,\n\nI would like to receive information about purchasing Villa Can Juan Ibiza.\n\nName:\nTelephone:\n\nKind regards,";
  return `mailto:info@mzsgroup.eu?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
};

export default function VillaCanJuanInvestment({ allowInvestment, allowAcquisition }: { allowInvestment: boolean; allowAcquisition: boolean }) {
  return (
    <div className={styles.investment}>
      <section className={styles.hero} aria-label="Villa Can Juan Ibiza investment introduction">
        <Image src={`${base}/vision-09.webp`} alt="Architectural visualisation of Villa Can Juan Ibiza and Mediterranean gardens" fill priority sizes="100vw" className={styles.heroImage} />
        <div className={styles.heroShade} />
        <div className={styles.heroCopy}>
          <p className={styles.eyebrow}>MZS GROUP / PRIVATE INVESTMENTS / IBIZA</p>
          <h1>Villa Can Juan <em>Ibiza</em></h1>
          <p className={styles.lead}>A private countryside estate opportunity in Santa Gertrudis, available through a private offering.</p>
          <div className={styles.actions}>
            <a href="#opportunity" className={styles.goldButton}>EXPLORE THE OPPORTUNITY ↗</a>
            <a href="#acquisition" className={styles.outlineButton}>INVEST OR ACQUIRE ↓</a>
          </div>
        </div>
        <span className={styles.heroFoot}>ARCHITECTURAL VISUALISATION · PROPOSED DESIGN</span>
      </section>
      <nav className={styles.nav} aria-label="Project sections">
        <span>VILLA CAN JUAN IBIZA</span>
        <div><a href="#opportunity">OVERVIEW</a><a href="#architecture">DESIGN</a><a href="#progress">PROGRESS</a><a href="#acquisition">ENQUIRE ↗</a></div>
      </nav>
      <section className={styles.metrics} aria-label="Documented property details">
        <div><strong>18,400 <small>m²</small></strong><span>REGISTERED PLOT AREA</span></div>
        <div><strong>121 <small>m²</small></strong><span>CADASTRAL BUILT AREA</span></div>
        <div><strong>IBIZA</strong><span>SANTA GERTRUDIS AREA</span></div>
        <div><strong>{allowInvestment && allowAcquisition ? "2 WAYS" : "PRIVATE"}</strong><span>{allowInvestment && allowAcquisition ? "INVESTMENT / ACQUISITION" : allowInvestment ? "INVESTMENT" : "ACQUISITION"}</span></div>
      </section>
      <section className={styles.intro} id="opportunity">
        <div className={styles.introAside}><p className={styles.eyebrow}>01 / THE OPPORTUNITY</p><p className={styles.smallNote}>A considered real-estate opportunity presented through MZS Group's private collection.</p></div>
        <div className={styles.introMain}>
          <h2>A distinctive estate. <em>A private opportunity.</em></h2>
          <p>Villa Can Juan Ibiza is a rural property in the Santa Gertrudis area of Ibiza, combining traditional stone architecture with a contemporary design vision. The site is offered as an opportunity for investors interested in participating in a property project, subject to the offering access granted to each private client.</p>
          <p>The concept imagery illustrates an aspirational architectural direction. Separate photographs document physical works at the site. The extent, status and permissibility of works shown in either set of images require independent technical and legal verification.</p>
        </div>
      </section>
      <section className={styles.galleryBlock} id="architecture">
        <header className={styles.sectionHead}><div><p className={styles.eyebrow}>02 / ARCHITECTURAL VISION</p><h2>A refined Mediterranean <em>expression.</em></h2></div><p>Concept visualisations · not photographs of the completed property.</p></header>
        <PropertyGallery photos={vision} title="Villa Can Juan Ibiza — architectural vision" />
      </section>
      <section className={styles.galleryBlockAlt} id="progress">
        <header className={styles.sectionHead}><div><p className={styles.eyebrow}>03 / DEVELOPMENT PROGRESS</p><h2>The project <em>on site.</em></h2></div><p>Site photography supplied by the project representative. Photography date and current completion status are not independently verified.</p></header>
        <PropertyGallery photos={progress} title="Villa Can Juan Ibiza — development progress" />
      </section>
      <section className={styles.detailSection} id="location">
        <div><p className={styles.eyebrow}>04 / PROPERTY & LOCATION</p><h2>Santa Gertrudis, <em>Ibiza.</em></h2></div>
        <div><p>The land is registered in the municipality of Santa Eulària des Riu, in the Santa Gertrudis parish, under property registration number 1643 and cadastral reference 07054A027000510000WK.</p><p>According to documents dated November–December 2024, the registered parcel measures 1.84 hectares and the cadastral record describes 121 m² of built area. These historical records should be refreshed before a transaction.</p><p className={styles.fine}>The land registry extract includes access and utility easements. Title, encumbrances, planning permissions, building licences, technical drawings, budgets and project status should be assessed during due diligence. The quoted area is not a statement of approved development potential.</p></div>
      </section>
      <section className={styles.opportunities} id="acquisition">
        <div className={styles.centerHeader}><p className={styles.eyebrow}>05 / PRIVATE ENQUIRY</p><h2>Explore your <em>opportunity.</em></h2><p>Full transaction terms and supporting documentation are available for discussion directly with MZS Group. No return or price is represented on this page.</p></div>
        <div className={styles.optionGrid}>
          {allowInvestment && <article><span>01 / PARTICIPATION</span><h3>Investment Opportunity</h3><p>Express your interest in participating in the project. Investment structure, capital requirements, timelines, risk factors and potential returns are subject to separate documentation and agreement.</p><a href={enquiry("investment")} className={styles.goldButton}>REQUEST INVESTMENT DETAILS ↗</a></article>}
          {allowAcquisition && <article><span>02 / FULL OWNERSHIP</span><h3>Acquisition Opportunity</h3><p>Enquire about acquiring the entire property. Price, scope of sale, conditions and the status of construction and permits will be discussed privately and verified as part of due diligence.</p><a href={enquiry("acquisition")} className={styles.outlineButton}>ENQUIRE ABOUT ACQUISITION ↗</a></article>}
        </div>
        <p className={styles.legal}>PRIVATE INFORMATION · Images are illustrative concept visualisations or supplied site photographs, as labelled. This presentation is not a public offer, financial forecast, guarantee of return or legal confirmation of permitted works.</p>
      </section>
    </div>
  );
}
