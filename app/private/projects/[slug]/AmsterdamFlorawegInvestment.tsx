"use client";
import ArrowUpRightIcon from "../../../components/ArrowUpRightIcon";

import {useTranslations, useLocale} from "next-intl";


import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import styles from "./amsterdamFlorawegInvestment.module.css";

type Props = { allowInvestment: boolean; allowAcquisition: boolean };
export default function AmsterdamFlorawegInvestment({allowInvestment,allowAcquisition}:Props) {
  const t = useTranslations("ProjectUI");
  const rtl = useLocale() === "ar";
  const base = "/properties/amsterdam-floraweg";
  const visuals = [
    {file:"hero-park-view.webp",label:t("p000")},
    {file:"hero-vuurwerkerweg-view.webp",label:t("p001")},
    {file:"hero-park-east-view.webp",label:t("p002")},
    {file:"architecture-overview.webp",label:t("p003")},
    {file:"green-facade-design.webp",label:t("p004")},
    {file:"neighborhood-context.webp",label:t("p005")},
  ];
  const technical = [
    {file:"floorplan-example.webp",title:t("p006"),detail:t("p007")},
    {file:"site-access-parking.webp",title:t("p008"),detail:t("p009")},
    {file:"sustainability-water-green.webp",title:t("p010"),detail:t("p011")},
    {file:"facade-material-detail.webp",title:t("p012"),detail:t("p013")},
    {file:"materials-palette-a.webp",title:t("p014"),detail:t("p015")},
    {file:"materials-palette-b.webp",title:t("p016"),detail:t("p015")},
    {file:"masonry-study.webp",title:t("p017"),detail:t("p018")},
  ];
  type GalleryItem = { file: string; title: string; detail: string; kind: "visual" | "plan" };
  const allGalleryItems: GalleryItem[] = [
    ...visuals.map(item => ({ file: item.file, title: item.label, detail: t("p019"), kind: "visual" as const })),
    ...technical.map(item => ({ file: item.file, title: item.title, detail: item.detail, kind: "plan" as const })),
  ];


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
  }, [allGalleryItems.length]);
  useEffect(() => {
    if (activeImage === null) return;
    closeButtonRef.current?.focus();
    const onKeyDown = (event:KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); closeImage(); }
      if (event.key === "ArrowLeft") { event.preventDefault(); stepImage(rtl ? 1 : -1); }
      if (event.key === "ArrowRight") { event.preventDefault(); stepImage(rtl ? -1 : 1); }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [activeImage, closeImage, stepImage, rtl]);

  const mail = (kind: "investment" | "acquisition") => {
    const label = t(kind === "investment" ? "investmentKind" : "acquisitionKind");
    return `mailto:info@mzsgroup.eu?subject=${encodeURIComponent(t("floraSubject", {kind: label}))}&body=${encodeURIComponent(t("floraBody", {kind: label}))}`;
  };
  return <div className={styles.project}>
    <section className={styles.hero}>
      <Image src={`${base}/hero-park-view.webp`} alt={t("p020")} fill priority sizes="100vw" className={styles.heroImage}/>
      <div className={styles.heroOverlay}/>
      <div className={styles.heroContent}>
        <p className={styles.eyebrow}>{t("p021")}</p>
        <h1>Amsterdam<br/>Floraweg</h1>
        <p className={styles.heroLead}>{t("p024")}</p>
        <div className={styles.heroActions}>
          <a href="#opportunity" className={styles.goldButton}>{t("p025")}</a>
          <a href="#architecture" className={styles.outlineButton}>{t("p026")}</a>
        </div>
      </div>
      <span className={styles.heroNote}>{t("p027")}</span>
    </section>
    <nav className={styles.nav} aria-label={t("p028")}>
      <span>FLORAWEG / AMS003</span><div><a href="#overview">{t("p030")}</a><a href="#architecture">{t("p031")}</a><a href="#plans">{t("p032")}</a><a href="#opportunity">{t("p033")}</a></div>
    </nav>
    <section id="overview" className={styles.overview}>
      <p className={styles.eyebrow}>{t("p034")}</p>
      <h2>{t("p035")}</h2>
      <p className={styles.intro}>{t("p036")}</p>
      <div className={styles.statGrid}>
        <div><strong>85</strong><span>{t("p037")}</span></div>
        <div><strong>DO</strong><span>{t("p039")}</span></div>
        <div><strong>AMS003</strong><span>{t("p041")}</span></div>
        <div><strong>AMSTERDAM</strong><span>{t("p043")}</span></div>
      </div>
      <p className={styles.smallPrint}>{t("p044")}</p>
    </section>
    <section id="architecture" className={styles.section}>
      <div className={styles.heading}><div><p className={styles.eyebrow}>{t("p045")}</p><h2>{t("p046")}</h2></div><p>{t("p047")}</p></div>
      <div className={styles.visualGrid}>{visuals.map((item,i)=><figure key={item.file} className={i===0?styles.largeVisual:styles.visual}><button type="button" className={styles.galleryTrigger} onClick={event => openImage(i,event.currentTarget)} aria-label={t("viewInGallery", {caption: item.label})}><Image src={`${base}/${item.file}`} alt={item.label} fill sizes={i===0?"(max-width: 800px) 100vw, 70vw":"(max-width: 800px) 100vw, 38vw"} className={styles.image}/></button><figcaption>{item.label} <span><ArrowUpRightIcon /></span></figcaption></figure>)}</div>
    </section>
    <section className={styles.story}>
      <div><p className={styles.eyebrow}>{t("p048")}</p><h2>{t("p049")}</h2></div>
      <div><p>{t("p050")}</p><p>{t("p051")}</p></div>
    </section>
    <section id="plans" className={styles.section}>
      <div className={styles.heading}><div><p className={styles.eyebrow}>{t("p052")}</p><h2>{t("p053")}</h2></div><p>{t("p054")}</p></div>
      <div className={styles.plansGrid}>{technical.map(item=><article key={item.file} className={styles.plan}><button type="button" className={styles.planTrigger} onClick={event => openImage(visuals.length + technical.findIndex(plan => plan.file === item.file), event.currentTarget)} aria-label={t("viewInGallery", {caption: item.title})}><div className={styles.planImage}><Image src={`${base}/${item.file}`} alt={item.title} fill sizes="(max-width: 800px) 100vw, 46vw" className={styles.planPhoto}/></div><div className={styles.planText}><h3>{item.title} <span>⤢</span></h3><p>{item.detail}</p></div></button></article>)}</div>
    </section>
    <section className={styles.sustainable}>
      <p className={styles.eyebrow}>{t("p055")}</p><h2>{t("p056")}</h2>
      <div className={styles.principles}><article><b>01</b><h3>{t("p010")}</h3><p>{t("p057")}</p></article><article><b>02</b><h3>{t("p058")}</h3><p>{t("p059")}</p></article><article><b>03</b><h3>{t("p060")}</h3><p>{t("p061")}</p></article></div>
    </section>
    <section id="opportunity" className={styles.opportunity}>
      <p className={styles.eyebrow}>{t("p062")}</p><h2>{t("p063")}</h2>
      <p>{t("p064")}</p>
      <div className={styles.cards}>
        {allowInvestment && <article><span>{t("p065")}</span><h3>{t("p066")}</h3><p>{t("p067")}</p><a href={mail("investment")}>{t("p069")}</a></article>}
        {allowAcquisition && <article><span>{t("p070")}</span><h3>{t("p071")}</h3><p>{t("p072")}</p><a href={mail("acquisition")}>{t("p074")}</a></article>}
      </div>
      <p className={styles.smallPrint}>{t("p075")}</p>
    </section>
    {activeImage !== null && (
      <div className={styles.lightbox} role="dialog" aria-modal="true" aria-label={t("p076")} onClick={event => { if (event.target === event.currentTarget) closeImage(); }}>
        <div className={styles.lightboxHeader}>
          <div><span className={styles.lightboxEyebrow}>MZS GROUP · AMSTERDAM FLORAWEG</span><strong>{allGalleryItems[activeImage].title}</strong></div>
          <button type="button" className={styles.lightboxClose} ref={closeButtonRef} onClick={closeImage} aria-label={t("p078")}>{t("p079")}</button>
        </div>
        <div className={styles.lightboxViewport}>
          <button type="button" className={styles.galleryArrow} onClick={() => stepImage(-1)} aria-label={t("p080")}>{rtl ? "→" : "←"}</button>
          <div className={`${styles.lightboxCanvas} ${zoomed ? styles.lightboxCanvasZoom : ""}`}>
            <Image src={`${base}/${allGalleryItems[activeImage].file}`} alt={allGalleryItems[activeImage].title} fill sizes="100vw" className={styles.lightboxPicture} priority={false}/>
          </div>
          <button type="button" className={styles.galleryArrow} onClick={() => stepImage(1)} aria-label={t("p081")}>{rtl ? "←" : "→"}</button>
        </div>
        <div className={styles.lightboxFooter}>
          <div><span>{String(activeImage + 1).padStart(2,"0")} / {String(allGalleryItems.length).padStart(2,"0")}</span><p>{allGalleryItems[activeImage].detail}</p></div>
          <button type="button" className={styles.zoomButton} onClick={() => setZoomed(value => !value)} aria-pressed={zoomed}>{zoomed ? t("p082") : t("p083")}</button>
        </div>
        <span className={styles.lightboxHint}>{t("p084")}</span>
      </div>
    )}
  </div>;
}
