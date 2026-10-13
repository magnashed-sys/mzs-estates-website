"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import styles from "./amsterdamFlorawegInvestment.module.css";

type Props = { allowInvestment: boolean; allowAcquisition: boolean };
const base = "/properties/amsterdam-floraweg";
const visuals = [
  {file:"hero-park-view.webp",label:"View from Buiksloterdijkpark · concept impression"},
  {file:"hero-vuurwerkerweg-view.webp",label:"View from Vuurwerkerweg · concept impression"},
  {file:"hero-park-east-view.webp",label:"Eastern park view · concept impression"},
  {file:"architecture-overview.webp",label:"Architectural massing and facade study"},
  {file:"green-facade-design.webp",label:"Green facade concept"},
  {file:"neighborhood-context.webp",label:"Neighbourhood and design context"},
];
const technical = [
  {file:"floorplan-example.webp",title:"Indicative residential floor plan",detail:"Apartment layout example · design drawing, subject to change"},
  {file:"site-access-parking.webp",title:"Site access & parking",detail:"Indicative urban plan and parking access coordination"},
  {file:"sustainability-water-green.webp",title:"Green infrastructure",detail:"Green roofs, facade planting and water retention concepts"},
  {file:"facade-material-detail.webp",title:"Facade design",detail:"Masonry, balcony and architectural detailing"},
  {file:"materials-palette-a.webp",title:"Material palette A",detail:"Concept material study"},
  {file:"materials-palette-b.webp",title:"Material palette B",detail:"Concept material study"},
  {file:"masonry-study.webp",title:"Masonry research",detail:"Indicative facade finishes"},
];
type GalleryItem = { file: string; title: string; detail: string; kind: "visual" | "plan" };
const allGalleryItems: GalleryItem[] = [
  ...visuals.map(item => ({ file: item.file, title: item.label, detail: "Architectural concept impression · subject to further design development", kind: "visual" as const })),
  ...technical.map(item => ({ file: item.file, title: item.title, detail: item.detail, kind: "plan" as const })),
];

export default function AmsterdamFlorawegInvestment({allowInvestment,allowAcquisition}:Props) {
  const [activeImage, setActiveImage] = useState<number | null>(null);
  const [zoomed, setZoomed] = useState(false);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const lastTriggerRef = useRef<HTMLButtonElement | null>(null);

  const openImage = (index:number, trigger:HTMLButtonElement) => {
    lastTriggerRef.current = trigger;
    setZoomed(false);
    setActiveImage(index);
  };
  const closeImage = useCallback(() => {
    setActiveImage(null);
    setZoomed(false);
    requestAnimationFrame(() => lastTriggerRef.current?.focus());
  }, []);
  const stepImage = useCallback((amount:number) => {
    setZoomed(false);
    setActiveImage(index => index === null ? null : (index + amount + allGalleryItems.length) % allGalleryItems.length);
  }, []);
  useEffect(() => {
    if (activeImage === null) return;
    closeButtonRef.current?.focus();
    const onKeyDown = (event:KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); closeImage(); }
      if (event.key === "ArrowLeft") { event.preventDefault(); stepImage(-1); }
      if (event.key === "ArrowRight") { event.preventDefault(); stepImage(1); }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [activeImage, closeImage, stepImage]);

  const subject = (kind:string)=>`MZS Group | Amsterdam Floraweg | ${kind} enquiry`;
  const mail = (kind:string)=>`mailto:info@mzsgroup.eu?subject=${encodeURIComponent(subject(kind))}&body=${encodeURIComponent(`Dear MZS Group,\n\nI would like to receive further information regarding the ${kind.toLowerCase()} opportunity for Amsterdam Floraweg.\n\nKind regards,\n`)}`;
  return <div className={styles.project}>
    <section className={styles.hero}>
      <Image src={`${base}/hero-park-view.webp`} alt="Architectural concept of Amsterdam Floraweg residential development viewed from the park" fill priority sizes="100vw" className={styles.heroImage}/>
      <div className={styles.heroOverlay}/>
      <div className={styles.heroContent}>
        <p className={styles.eyebrow}>MZS GROUP / PRIVATE REAL ESTATE / AMSTERDAM</p>
        <h1>Amsterdam<br/>Floraweg</h1>
        <p className={styles.heroLead}>An urban residential development opportunity in Amsterdam’s Klaprozenbuurt.</p>
        <div className={styles.heroActions}>
          <a href="#opportunity" className={styles.goldButton}>EXPLORE THE OPPORTUNITY ↗</a>
          <a href="#architecture" className={styles.outlineButton}>ARCHITECTURAL VISION ↓</a>
        </div>
      </div>
      <span className={styles.heroNote}>ARCHITECTURAL IMPRESSION · CONCEPT DESIGN / DO PHASE</span>
    </section>
    <nav className={styles.nav} aria-label="Project sections">
      <span>FLORAWEG / AMS003</span><div><a href="#overview">OVERVIEW</a><a href="#architecture">DESIGN</a><a href="#plans">PLANS</a><a href="#opportunity">INVESTMENT</a></div>
    </nav>
    <section id="overview" className={styles.overview}>
      <p className={styles.eyebrow}>THE DEVELOPMENT / EXECUTIVE OVERVIEW</p>
      <h2>A considered addition to Amsterdam’s urban landscape.</h2>
      <p className={styles.intro}>Amsterdam Floraweg is a proposed residential development in the Klaprozenbuurt, Amsterdam. The latest supplied design material presents a distinctive tower composition, articulated brick facades and a considered relationship with the surrounding public realm. The investment proposition is presented privately to selected MZS Group clients and partners.</p>
      <div className={styles.statGrid}>
        <div><strong>85</strong><span>PROPOSED UNITS</span></div>
        <div><strong>DO</strong><span>CONCEPT DESIGN PHASE</span></div>
        <div><strong>AMS003</strong><span>PROJECT REFERENCE</span></div>
        <div><strong>AMSTERDAM</strong><span>THE NETHERLANDS</span></div>
      </div>
      <p className={styles.smallPrint}>Programme: 85 Units (MZS Group project brief). The supplied presentation is a concept design study dated September 2025; programme, specifications, planning and approvals remain subject to verification and further development.</p>
    </section>
    <section id="architecture" className={styles.section}>
      <div className={styles.heading}><div><p className={styles.eyebrow}>01 / ARCHITECTURE</p><h2>Architectural vision.</h2></div><p>Selected concept impressions from the latest FARO design presentation. Imagery is indicative and is not a representation of completed works.</p></div>
      <div className={styles.visualGrid}>{visuals.map((item,i)=><figure key={item.file} className={i===0?styles.largeVisual:styles.visual}><button type="button" className={styles.galleryTrigger} onClick={event => openImage(i,event.currentTarget)} aria-label={`View ${item.label} in gallery`}><Image src={`${base}/${item.file}`} alt={item.label} fill sizes={i===0?"(max-width: 800px) 100vw, 70vw":"(max-width: 800px) 100vw, 38vw"} className={styles.image}/></button><figcaption>{item.label} <span>↗</span></figcaption></figure>)}</div>
    </section>
    <section className={styles.story}>
      <div><p className={styles.eyebrow}>02 / DESIGN PRINCIPLES</p><h2>Materiality, rhythm and urban connection.</h2></div>
      <div><p>The presentation explores the relationship between the tower crown, lower plinth and residential facades, with carefully considered masonry tones, aluminium framing, balconies and green detailing.</p><p>Design development has included supervisory comments about the tower articulation, balcony treatment, materials and the proposed parking entrance. These remain matters for ongoing design coordination, rather than confirmed final specifications.</p></div>
    </section>
    <section id="plans" className={styles.section}>
      <div className={styles.heading}><div><p className={styles.eyebrow}>03 / TECHNICAL MATERIAL</p><h2>Floor plans & design studies.</h2></div><p>Select a drawing to view it within the gallery. Use the zoom control for a closer look. Plans are indicative and may change.</p></div>
      <div className={styles.plansGrid}>{technical.map(item=><article key={item.file} className={styles.plan}><button type="button" className={styles.planTrigger} onClick={event => openImage(visuals.length + technical.findIndex(plan => plan.file === item.file), event.currentTarget)} aria-label={`View ${item.title} in gallery`}><div className={styles.planImage}><Image src={`${base}/${item.file}`} alt={item.title} fill sizes="(max-width: 800px) 100vw, 46vw" className={styles.planPhoto}/></div><div className={styles.planText}><h3>{item.title} <span>⤢</span></h3><p>{item.detail}</p></div></button></article>)}</div>
    </section>
    <section className={styles.sustainable}>
      <p className={styles.eyebrow}>04 / SUSTAINABILITY & PLACE</p><h2>Landscape and resilience are part of the design dialogue.</h2>
      <div className={styles.principles}><article><b>01</b><h3>Green infrastructure</h3><p>Green roof and facade planting measures are explored in the current concept.</p></article><article><b>02</b><h3>Water management</h3><p>Roof-based water retention features are proposed for further design development.</p></article><article><b>03</b><h3>Urban ecology</h3><p>Potential nesting provisions are identified for coordination with a city ecologist.</p></article></div>
    </section>
    <section id="opportunity" className={styles.opportunity}>
      <p className={styles.eyebrow}>05 / PRIVATE OPPORTUNITIES</p><h2>A private conversation about the next stage.</h2>
      <p>Financial assumptions, participation structure, pricing, projected returns and transaction conditions are provided only when available and separately confirmed. No financial return or permit approval is implied by this presentation.</p>
      <div className={styles.cards}>
        {allowInvestment && <article><span>01 / INVESTMENT</span><h3>Investment Opportunity</h3><p>Discuss participation possibilities and request the current investment materials.</p><a href={mail("Investment")}>ENQUIRE ABOUT INVESTMENT ↗</a></article>}
        {allowAcquisition && <article><span>02 / PRIVATE SALE</span><h3>Private Acquisition</h3><p>Request a private discussion regarding potential acquisition terms.</p><a href={mail("Acquisition")}>ENQUIRE ABOUT ACQUISITION ↗</a></article>}
      </div>
      <p className={styles.smallPrint}>Private and confidential. Access is granted per project and offering. All concept drawings and illustrations are subject to further design development and applicable approvals. Source: FARO / AMS003 concept presentation, 10 September 2025.</p>
    </section>
    {activeImage !== null && (
      <div className={styles.lightbox} role="dialog" aria-modal="true" aria-label="Amsterdam Floraweg image gallery" onClick={event => { if (event.target === event.currentTarget) closeImage(); }}>
        <div className={styles.lightboxHeader}>
          <div><span className={styles.lightboxEyebrow}>MZS GROUP · AMSTERDAM FLORAWEG</span><strong>{allGalleryItems[activeImage].title}</strong></div>
          <button type="button" className={styles.lightboxClose} ref={closeButtonRef} onClick={closeImage} aria-label="Close gallery">CLOSE ×</button>
        </div>
        <div className={styles.lightboxViewport}>
          <button type="button" className={styles.galleryArrow} onClick={() => stepImage(-1)} aria-label="Previous image">←</button>
          <div className={`${styles.lightboxCanvas} ${zoomed ? styles.lightboxCanvasZoom : ""}`}>
            <Image src={`${base}/${allGalleryItems[activeImage].file}`} alt={allGalleryItems[activeImage].title} fill sizes="100vw" className={styles.lightboxPicture} priority={false}/>
          </div>
          <button type="button" className={styles.galleryArrow} onClick={() => stepImage(1)} aria-label="Next image">→</button>
        </div>
        <div className={styles.lightboxFooter}>
          <div><span>{String(activeImage + 1).padStart(2,"0")} / {String(allGalleryItems.length).padStart(2,"0")}</span><p>{allGalleryItems[activeImage].detail}</p></div>
          <button type="button" className={styles.zoomButton} onClick={() => setZoomed(value => !value)} aria-pressed={zoomed}>{zoomed ? "FIT IMAGE −" : "ZOOM IN +"}</button>
        </div>
        <span className={styles.lightboxHint}>USE ← → TO NAVIGATE · ESC TO CLOSE</span>
      </div>
    )}
  </div>;
}
