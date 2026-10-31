import {useLocale, useTranslations} from "next-intl";
import Image from "next/image";
import ProjectTimeline from "../../../components/projects/ProjectTimeline";
import IbizaLoanTerms from "../../../components/projects/IbizaLoanTerms";
import PropertyGallery, { type PropertyPhoto } from "./PropertyGallery";
import {canJuanAreaQuery, canJuanDutchCopy, canJuanDutchVisionOrder} from "./canJuanPresentation";
import styles from "./villaCanJuanInvestment.module.css";

export default function VillaCanJuanInvestment({ allowInvestment, allowAcquisition }: { allowInvestment: boolean; allowAcquisition: boolean }) {
  const translations = useTranslations("ProjectUI");
  const dutch = useLocale() === "nl";
  const t = (key: string) => dutch ? canJuanDutchCopy[key] ?? translations(key) : translations(key);
  const base = "/properties/villa-can-juan-ibiza";
  const visionCaptions = [
    t("p172"), t("p173"), t("p174"), t("p175"),
    t("p176"), t("p177"), t("p178"),
    t("p179"), t("p180"), t("p181"),
    t("p182"), t("p183"), t("p184"),
    t("p185"), t("p186"), t("p187"),
    t("p188"), t("p189"),
  ];
  const progressCaptions = [
    t("p190"),
    t("p191"),
    t("p192"),
    t("p193"),
  ];
  const originalVision: PropertyPhoto[] = visionCaptions.map((caption, i) => ({
    src: `${base}/vision-${String(i + 1).padStart(2, "0")}.webp`, alt: caption, caption,
  }));
  const vision = dutch ? canJuanDutchVisionOrder.map(number => originalVision[number - 1]) : originalVision;
  const progress: PropertyPhoto[] = progressCaptions.map((caption, i) => ({
    // progress-01.webp is a future-state visualisation and intentionally excluded.
    src: `${base}/progress-${String(i + 2).padStart(2, "0")}.webp`, alt: caption, caption,
  }));

  const enquiry = (kind: "investment" | "acquisition") => {
    const subject = kind === "investment"
      ? t("p194")
      : t("p195");
    const body = kind === "investment"
      ? t("p196")
      : t("p197");
    return `mailto:info@mzsgroup.eu?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  };


  const timeline = <div id="timeline" className={dutch ? styles.anchorTarget : undefined}><ProjectTimeline milestones={{site:{date:"2022",status:"completed"},permit:{date:"2025",status:"completed"},construction:{date:"2026",status:"current"},completion:{date:"Q4 2027",status:"planned"}}} /></div>;
  const enquiryLabel = dutch && !(allowInvestment && allowAcquisition)
    ? allowInvestment ? "INFORMEER NAAR INVESTEREN ↓" : "INFORMEER NAAR AANKOOP ↓"
    : t("p204");

  return (
    <div className={styles.investment}>
      <section className={styles.hero} aria-label={t("p198")}>
        <Image src={`${base}/vision-09.webp`} alt={t("p199")} fill priority sizes="100vw" className={styles.heroImage} />
        <div className={styles.heroShade} />
        <div className={styles.heroCopy}>
          <p className={styles.eyebrow}>{t("p200")}</p>
          <h1>Villa Can Juan <em>Ibiza</em></h1>
          <p className={styles.lead}>{t("p203")}</p>
          <div className={styles.actions}>
            <a href="#opportunity" className={styles.goldButton}>{t("p025")}</a>
            <a href="#acquisition" className={styles.outlineButton}>{enquiryLabel}</a>
          </div>
        </div>
        <span className={styles.heroFoot}>{t("p205")}</span>
      </section>
      <nav className={styles.nav} aria-label={t("p028")}>
        <span>VILLA CAN JUAN IBIZA</span>
        {dutch ? <div><a href="#opportunity">{t("p030")}</a><a href="#architecture">{t("p031")}</a><a href="#progress">{t("p208")}</a><a href="#timeline">{t("p207")}</a><a href="#location">LOCATIE</a>{allowInvestment && <a href="#financing">{t("p033")}</a>}<a href="#acquisition">{t("p209")}</a></div> : <div><a href="#opportunity">{t("p030")}</a><a href="#architecture">{t("p031")}</a><a href="#timeline">{t("p207")}</a><a href="#progress">{t("p208")}</a><a href="#acquisition">{t("p209")}</a></div>}
      </nav>
      <section className={styles.metrics} aria-label={t("p210")}>
        <div><strong>{dutch ? "18.400" : "18,400"} <small>m²</small></strong><span>{t("p212")}</span></div>
        <div><strong>{dutch ? "343,35" : "343.35"} <small>m²</small></strong><span>{t("p213")}</span></div>
        <div><strong>IBIZA</strong><span>{t("p215")}</span></div>
        <div><strong>{allowInvestment && allowAcquisition ? dutch ? "2 ROUTES" : "2 WAYS" : t("p216")}</strong><span>{allowInvestment && allowAcquisition ? t("p217") : allowInvestment ? t("p033") : t("p218")}</span></div>
      </section>
      <section className={styles.intro} id="opportunity">
        <div className={styles.introAside}><p className={styles.eyebrow}>{t("p219")}</p><p className={styles.smallNote}>{t("p220")}</p></div>
        <div className={styles.introMain}>
          <h2>{t("p221")} <em>{t("p222")}</em></h2>
          <p>{t("p223")}</p>
          <p>{t("p224")}</p>
        </div>
      </section>
      {!dutch && timeline}
      {!dutch && allowInvestment && <IbizaLoanTerms />}
      <section className={styles.galleryBlock} id="architecture">
        <header className={styles.sectionHead}><div><p className={styles.eyebrow}>{t("p226")}</p><h2><em>{t("canJuanExpression")}</em></h2></div><p>{t("p229")}</p></header>
        <PropertyGallery photos={vision} title={t("p230")} />
      </section>
      <section className={styles.galleryBlockAlt} id="progress">
        <header className={styles.sectionHead}><div><p className={styles.eyebrow}>{t("p231")}</p><h2>{t("p232")} <em>{t("p233")}</em></h2></div><p>{t("p234")}</p></header>
        <PropertyGallery photos={progress} title={t("p235")} />
      </section>
      {dutch && timeline}
      <section className={styles.detailSection} id="location">
        <div><p className={styles.eyebrow}>{t("p236")}</p><h2>Santa Gertrudis, <em>Ibiza.</em></h2></div>
        <div><p>{t("p239")}</p><p>{t("p240")}</p><p className={styles.fine}>{t("p241")}</p>
          {dutch && <div className={styles.areaMap}>
            <iframe src={`https://maps.google.com/maps?q=${encodeURIComponent(canJuanAreaQuery)}&z=12&output=embed`}
              title="Omgeving Santa Gertrudis · indicatieve locatie Villa Can Juan" loading="lazy"
              referrerPolicy="no-referrer-when-downgrade" allowFullScreen />
            <p className={styles.fine}>Indicatieve omgeving · geen exacte objectlocatie.</p>
            <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(canJuanAreaQuery)}`}
              target="_blank" rel="noopener noreferrer" className={styles.outlineButton}>BEKIJK DE OMGEVING ↗</a>
          </div>}
        </div>
      </section>
      {dutch && allowInvestment && <div id="financing" className={styles.anchorTarget}><IbizaLoanTerms /></div>}
      <section className={styles.opportunities} id="acquisition">
        <div className={styles.centerHeader}><p className={styles.eyebrow}>{t("p242")}</p><h2>{t("p243")} <em>{t("p244")}</em></h2><p>{t("p245")}</p></div>
        <div className={styles.optionGrid}>
          {allowInvestment && <article><span>{t("p246")}</span><h3>{t("p066")}</h3><p>{t("p247")}</p><a href={enquiry("investment")} className={styles.goldButton}>{t("p248")}</a></article>}
          {allowAcquisition && <article><span>{t("p249")}</span><h3>{t("p250")}</h3><p>{t("p251")}</p><a href={enquiry("acquisition")} className={styles.outlineButton}>{t("p074")}</a></article>}
        </div>
        <p className={styles.legal}>{t("p252")}</p>
      </section>
    </div>
  );
}
