import Image from "next/image";
import PropertyGallery, { type PropertyPhoto } from "./PropertyGallery";
import styles from "./villaDesColomsInvestment.module.css";

const base = "/properties/villa-des-coloms-ibiza";
const captions = [
  "Architectural aerial view · entrance and pool", "Elevated architectural overview",
  "Terraced residence design", "Poolside elevation concept", "Development overview",
  "Continuous terrace and glazing", "Facade and outdoor living concept",
  "Long elevation and pool terrace", "Roof and site arrangement",
  "Rear elevation and landscaping", "Longitudinal building concept",
  "Architectural concept in landscape",
];
const gallery: PropertyPhoto[] = captions.map((caption, index) => ({
  src: `${base}/vision-${String(index + 1).padStart(2, "0")}.webp`,
  alt: caption, caption,
}));
const subject = encodeURIComponent("Villa des Coloms Ibiza — Investment Enquiry");
const body = encodeURIComponent("Dear MZS Group,\n\nI would like to receive further information on the investment opportunity for Villa des Coloms Ibiza.\n\nName:\nCompany:\nTelephone:\n\nKind regards,");
const contact = `mailto:info@mzsgroup.eu?subject=${subject}&body=${body}`;

export default function VillaDesColomsInvestment() {
  return <div className={styles.investment}>
    <section className={styles.hero} aria-label="Villa des Coloms Ibiza private investment">
      <Image src={`${base}/vision-12.webp`} alt="Proposed Villa des Coloms Ibiza architectural concept within a woodland setting" fill priority sizes="100vw" className={styles.heroImage} />
      <div className={styles.heroShade} />
      <div className={styles.heroCopy}>
        <p className={styles.eyebrow}>MZS GROUP / PRIVATE INVESTMENTS / IBIZA</p>
        <h1>Villa des Coloms <em>Ibiza</em></h1>
        <p className={styles.lead}>A contemporary architectural development concept in the hills of Santa Eulària des Riu, presented exclusively as a private investment opportunity.</p>
        <div className={styles.actions}><a href="#opportunity" className={styles.goldButton}>EXPLORE THE INVESTMENT ↗</a><a href="#architecture" className={styles.outlineButton}>VIEW ARCHITECTURAL VISION ↓</a></div>
      </div>
      <span className={styles.heroFoot}>DESIGN VISUALISATION · PROPOSED DEVELOPMENT</span>
    </section>
    <nav className={styles.nav} aria-label="Project sections"><span>VILLA DES COLOMS IBIZA</span><div><a href="#opportunity">OVERVIEW</a><a href="#architecture">DESIGN</a><a href="#details">PROJECT DATA</a><a href="#investment">INVESTMENT ↗</a></div></nav>
    <section className={styles.metrics} aria-label="Architectural project measurements">
      <div><strong>16,254 <small>m²</small></strong><span>SITE AREA · DRAWINGS</span></div>
      <div><strong>195.64 <small>m²</small></strong><span>PROPOSED COUNTABLE FLOOR AREA</span></div>
      <div><strong>183.55 <small>m²</small></strong><span>PROPOSED BASEMENT · NON-COUNTABLE</span></div>
      <div><strong>35 <small>m²</small></strong><span>PROPOSED POOL WATER AREA</span></div>
    </section>
    <section className={styles.intro} id="opportunity"><div className={styles.introAside}><p className={styles.eyebrow}>01 / INVESTMENT OVERVIEW</p><p className={styles.smallNote}>Private architectural development concept · Santa Eulària des Riu, Ibiza.</p></div>
      <div className={styles.introMain}><h2>Modern architecture. <em>A considered opportunity.</em></h2><p>Villa des Coloms Ibiza is presented as a proposed detached residence and swimming-pool development at Parcela 256, Polígono 16, Venda des Coloms, within the municipality of Santa Eulària des Riu.</p><p>The December 2025 basic architectural drawings propose a low-profile residence following the contours of the site, with outdoor terraces, landscape integration and a dedicated lower-ground level. The images on this page are design visualisations and do not represent an existing completed residence.</p><p>Participation terms, construction budget, programme, regulatory approvals and any financial projections remain subject to separate documentation and due diligence.</p></div>
    </section>
    <section className={styles.galleryBlock} id="architecture"><header className={styles.sectionHead}><div><p className={styles.eyebrow}>02 / ARCHITECTURAL VISION</p><h2>A quiet, contemporary <em>expression.</em></h2></div><p>Twelve concept images illustrating the proposed architecture, terraces, landscaped grounds and pool. Renderings are not evidence of completion or permission.</p></header><PropertyGallery photos={gallery} title="Villa des Coloms Ibiza — architectural concept" /></section>
    <section className={styles.detailSection} id="details"><div><p className={styles.eyebrow}>03 / PROPOSED DEVELOPMENT</p><p className={styles.smallNote}>Figures reproduced from the Proyecto Básico architectural drawing set dated December 2025.</p></div><div><h2>Documented architectural <em>scope.</em></h2><p>The basic plans describe three double bedrooms at ground-floor level, an open living–dining–kitchen area, covered porches and pergola, and a basement level incorporating a gym, secondary living area, laundry and ancillary rooms.</p><p>The plans show 177.81 m² of enclosed ground-floor built area plus 17.83 m² of covered porches (195.64 m² total countable area); 183.55 m² of enclosed basement area designated non-countable; and a proposed 8.75 × 4.00 m swimming pool.</p><p>The useful enclosed residential area stated in the plans is 254.53 m² across both levels, and the planned occupancy is six places. These measurements have different definitions and should not be added together as a single marketed floor-area figure.</p><p className={styles.fine}>Planning note: The provided documents are titled “Proyecto Básico”. A signed basic design is not itself evidence of a granted building permit. Development feasibility, zoning, buildable surfaces and authorisations require independent verification.</p></div></section>
    <section className={styles.opportunities} id="investment"><header className={styles.centerHeader}><p className={styles.eyebrow}>04 / PRIVATE PARTICIPATION</p><h2>Investment <em>opportunity.</em></h2><p>This project is available for investment enquiries only. Acquisition of the complete project is not offered through this presentation.</p></header><div className={styles.optionGrid} style={{gridTemplateColumns:"minmax(0,1fr)",maxWidth:760,margin:"0 auto"}}><article><span>01 / PRIVATE INVESTMENT</span><h3>Explore participation.</h3><p>Request details about the proposed project, participation structure, estimated capital requirements, projected timeline and supporting due-diligence materials when available.</p><a href={contact} className={styles.goldButton}>REQUEST INVESTMENT INFORMATION ↗</a></article></div><p className={styles.legal}>Confidential project introduction only. No financial returns, investment guarantees or licence status are represented or implied. All proposals are subject to verification and final documentation.</p></section>
  </div>;
}
