"use client";
import ArrowUpRightIcon from "../../../components/ArrowUpRightIcon";

import {useTranslations, useLocale} from "next-intl";


import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import {florawegMilestones} from "../../../../lib/projects/floraweg-milestones";
import { florawegVisuals } from "../../../../lib/floraweg-visuals";
import styles from "./amsterdamFlorawegInvestment.module.css";

type Props = { allowInvestment: boolean; allowAcquisition: boolean };
export default function AmsterdamFlorawegInvestment({allowInvestment,allowAcquisition}:Props) {
  const t = useTranslations("ProjectUI");
  const locale = useLocale();
  const rtl = locale === "ar";
  const milestones = florawegMilestones(locale);
  const base = "/api/project-visual/amsterdam-floraweg";
  const localize = (item: (typeof florawegVisuals)[number]) => ({
    ...item,
    title: item.floor ? t("floraFloor", {floor: item.floor}) : item.section ? t("floraSection", {section: item.section}) : item.file === "dak.webp" ? t("floraRoof") : `${t(item.labelKey)}${item.suffix ? ` · ${item.suffix}` : ""}`,
    detail: t("p044"),
  });
  const allGalleryItems = florawegVisuals.map(localize);
  const visuals = allGalleryItems.filter(item => item.group === "impressions");
  const details = allGalleryItems.filter(item => item.group === "details");
  const technical = allGalleryItems.filter(item => item.featured);
  const groups = [
    {id: "context", title: t("p005")},
    {id: "architecture", title: t("p012")},
    {id: "plans", title: t("p053")},
    {id: "landscape", title: t("p010")},
  ];
  const imageIndex = (file: string) => allGalleryItems.findIndex(item => item.file === file);

  const [activeImage, setActiveImage] = useState<number | null>(null);
  const [zoomed, setZoomed] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
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
  const galleryIsOpen = activeImage !== null;
  useEffect(() => {
    if (!galleryIsOpen) return;
    closeButtonRef.current?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event:KeyboardEvent) => {
      if (event.key === "Tab") {
        const buttons = Array.from(dialogRef.current?.querySelectorAll<HTMLButtonElement>("button:not(:disabled)") ?? []);
        const first = buttons[0], last = buttons[buttons.length - 1];
        if (event.shiftKey && document.activeElement === first) {event.preventDefault(); last?.focus();}
        else if (!event.shiftKey && document.activeElement === last) {event.preventDefault(); first?.focus();}
      }
      if (event.key === "Escape") { event.preventDefault(); closeImage(); }
      if (event.key === "ArrowLeft") { event.preventDefault(); stepImage(rtl ? 1 : -1); }
      if (event.key === "ArrowRight") { event.preventDefault(); stepImage(rtl ? -1 : 1); }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {window.removeEventListener("keydown", onKeyDown); document.body.style.overflow = previousOverflow;};
  }, [galleryIsOpen, closeImage, stepImage, rtl]);

  const mail = (kind: "investment" | "acquisition") => {
    const label = t(kind === "investment" ? "investmentKind" : "acquisitionKind");
    return `mailto:info@mzsgroup.eu?subject=${encodeURIComponent(t("floraSubject", {kind: label}))}&body=${encodeURIComponent(t("floraBody", {kind: label}))}`;
  };
  return <div className={styles.project}>
    <section className={styles.hero}>
      <Image unoptimized src={`${base}/park-noord.webp`} alt={t("p020")} fill priority sizes="100vw" className={styles.heroImage}/>
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
    <section id="milestones" className={styles.section} aria-labelledby="milestones-heading">
      <div className={styles.heading}><h2 id="milestones-heading">{milestones.heading}</h2></div>
      <div className={styles.milestones}>{milestones.items.map(item=><figure key={item.id} className={styles.milestone}>
        <Image unoptimized src={item.image} alt={item.caption} width={item.width} height={item.height} sizes="(max-width: 800px) 100vw, 88vw" className={styles.milestoneImage}/>
        <figcaption><time dateTime={item.date}>{new Intl.DateTimeFormat(locale,{dateStyle:"long",timeZone:"UTC"}).format(new Date(item.date))}</time><p>{item.caption}</p></figcaption>
      </figure>)}</div>
    </section>
    <section id="architecture" className={styles.section}>
      <div className={styles.heading}><div><p className={styles.eyebrow}>{t("p045")}</p><h2>{t("p046")}</h2></div><p>{t("p047")}</p></div>
      <div className={styles.visualGrid}>{visuals.map((item,i)=><figure key={item.file} className={i===0?styles.largeVisual:styles.visual}><button type="button" className={styles.galleryTrigger} onClick={event => openImage(imageIndex(item.file),event.currentTarget)} aria-label={t("viewInGallery", {caption: item.title})}><Image unoptimized src={`${base}/${item.file}`} alt={item.title} fill sizes={i===0?"(max-width: 800px) 100vw, 70vw":"(max-width: 800px) 100vw, 38vw"} className={styles.image}/></button><figcaption>{item.title} <span><ArrowUpRightIcon /></span></figcaption></figure>)}</div>
    </section>
    <section className={styles.story}>
      <div><p className={styles.eyebrow}>{t("p048")}</p><h2>{t("p049")}</h2></div>
      <div><p>{t("p050")}</p><p>{t("p051")}</p></div>
    </section>
    <div className={styles.detailGallery}>{details.map(item => <figure key={item.file}><button type="button" className={styles.detailTrigger} onClick={event => openImage(imageIndex(item.file), event.currentTarget)} aria-label={t("viewInGallery", {caption: item.title})}><Image unoptimized src={`${base}/${item.file}`} alt={item.title} width={item.width} height={item.height} sizes="(max-width: 650px) 100vw, 50vw"/></button><figcaption>{item.title}</figcaption></figure>)}</div>
    <section id="plans" className={styles.section}>
      <div className={styles.heading}><div><p className={styles.eyebrow}>{t("p052")}</p><h2>{t("p053")}</h2></div><p>{t("p054")}</p></div>
      <div className={styles.plansGrid}>{technical.map(item=><article key={item.file} className={styles.plan}><button type="button" className={styles.planTrigger} onClick={event => openImage(imageIndex(item.file), event.currentTarget)} aria-label={t("viewInGallery", {caption: item.title})}><div className={styles.planImage}><Image unoptimized src={`${base}/${item.file}`} alt={item.title} fill sizes="(max-width: 800px) 100vw, 46vw" className={styles.planPhoto}/></div><div className={styles.planText}><h3>{item.title} <span>⤢</span></h3></div></button></article>)}</div>
      <div className={styles.collections}>{groups.map(group => {
        const items = allGalleryItems.filter(item => item.group === group.id && !item.featured);
        return <details key={group.id} className={styles.collection}><summary>{group.title} <span>{items.length}</span></summary><div className={styles.plansGrid}>{items.map(item=><article key={item.file} className={styles.plan}><button type="button" className={styles.planTrigger} onClick={event => openImage(imageIndex(item.file), event.currentTarget)} aria-label={t("viewInGallery", {caption: item.title})}><div className={styles.planImage}><Image unoptimized src={`${base}/${item.file}`} alt={item.title} fill sizes="(max-width: 800px) 100vw, 46vw" className={styles.planPhoto}/></div><div className={styles.planText}><h3>{item.title} <span>⤢</span></h3></div></button></article>)}</div></details>;
      })}</div>
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
      <div ref={dialogRef} className={styles.lightbox} role="dialog" aria-modal="true" aria-label={t("p076")} onClick={event => { if (event.target === event.currentTarget) closeImage(); }}>
        <div className={styles.lightboxHeader}>
          <div><span className={styles.lightboxEyebrow}>MZS GROUP · AMSTERDAM FLORAWEG</span><strong>{allGalleryItems[activeImage].title}</strong></div>
          <button type="button" className={styles.lightboxClose} ref={closeButtonRef} onClick={closeImage} aria-label={t("p078")}>{t("p079")}</button>
        </div>
        <div className={styles.lightboxViewport}>
          <button type="button" className={styles.galleryArrow} onClick={() => stepImage(-1)} aria-label={t("p080")}>{rtl ? "→" : "←"}</button>
          <div className={`${styles.lightboxCanvas} ${zoomed ? styles.lightboxCanvasZoom : ""}`}>
            <div className={styles.lightboxStage}><Image unoptimized src={`${base}/${allGalleryItems[activeImage].file}`} alt={allGalleryItems[activeImage].title} fill sizes="100vw" className={styles.lightboxPicture}/></div>
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
