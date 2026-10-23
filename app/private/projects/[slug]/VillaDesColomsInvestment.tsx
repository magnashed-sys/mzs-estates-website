import {useTranslations} from "next-intl";
import Image from "next/image";
import PropertyGallery, { type PropertyPhoto } from "./PropertyGallery";
import styles from "./villaDesColomsInvestment.module.css";

export default function VillaDesColomsInvestment() {
  const t = useTranslations("ProjectUI");
  const base = "/properties/villa-des-coloms-ibiza";
  const captions = [
    t("p253"), t("p254"),
    t("p255"), t("p256"), t("p257"),
    t("p258"), t("p259"),
    t("p260"), t("p261"),
    t("p262"), t("p263"),
    t("p264"),
  ];
  const gallery: PropertyPhoto[] = captions.map((caption, index) => ({
    src: `${base}/vision-${String(index + 1).padStart(2, "0")}.webp`,
    alt: caption, caption,
  }));
  const subject = encodeURIComponent(t("p265"));
  const body = encodeURIComponent(t("p266"));
  const contact = `mailto:info@mzsgroup.eu?subject=${subject}&body=${body}`;


  return <div className={styles.investment}>
    <section className={styles.hero} aria-label={t("p267")}>
      <Image src={`${base}/vision-12.webp`} alt={t("p268")} fill priority sizes="100vw" className={styles.heroImage} />
      <div className={styles.heroShade} />
      <div className={styles.heroCopy}>
        <p className={styles.eyebrow}>{t("p200")}</p>
        <h1>Villa des Coloms <em>Ibiza</em></h1>
        <p className={styles.lead}>{t("p270")}</p>
        <div className={styles.actions}><a href="#opportunity" className={styles.goldButton}>{t("p271")}</a><a href="#architecture" className={styles.outlineButton}>{t("p272")}</a></div>
      </div>
      <span className={styles.heroFoot}>{t("p273")}</span>
    </section>
    <nav className={styles.nav} aria-label={t("p028")}><span>VILLA DES COLOMS IBIZA</span><div><a href="#opportunity">{t("p030")}</a><a href="#architecture">{t("p031")}</a><a href="#details">{t("p275")}</a><a href="#investment">{t("p276")}</a></div></nav>
    <section className={styles.metrics} aria-label={t("p277")}>
      <div><strong>16,254 <small>m²</small></strong><span>{t("p278")}</span></div>
      <div><strong>195.64 <small>m²</small></strong><span>{t("p279")}</span></div>
      <div><strong>183.55 <small>m²</small></strong><span>{t("p280")}</span></div>
      <div><strong>35 <small>m²</small></strong><span>{t("p281")}</span></div>
    </section>
    <section className={styles.intro} id="opportunity"><div className={styles.introAside}><p className={styles.eyebrow}>{t("p282")}</p><p className={styles.smallNote}>{t("p283")}</p></div>
      <div className={styles.introMain}><h2>{t("p284")} <em>{t("p285")}</em></h2><p>{t("p286")}</p><p>{t("p287")}</p><p>{t("p288")}</p></div>
    </section>
    <section className={styles.galleryBlock} id="architecture"><header className={styles.sectionHead}><div><p className={styles.eyebrow}>{t("p226")}</p><h2><em>{t("colomsExpression")}</em></h2></div><p>{t("p290")}</p></header><PropertyGallery photos={gallery} title={t("p291")} /></section>
    <section className={styles.detailSection} id="details"><div><p className={styles.eyebrow}>{t("p292")}</p><p className={styles.smallNote}>{t("p293")}</p></div><div><h2>{t("p294")} <em>{t("p295")}</em></h2><p>{t("p296")}</p><p>{t("p297")}</p><p>{t("p298")}</p><p className={styles.fine}>{t("p299")}</p></div></section>
    <section className={styles.opportunities} id="investment"><header className={styles.centerHeader}><p className={styles.eyebrow}>{t("p300")}</p><h2>{t("p068")} <em>{t("p244")}</em></h2><p>{t("p301")}</p></header><div className={styles.optionGrid} style={{gridTemplateColumns:"minmax(0,1fr)",maxWidth:760,margin:"0 auto"}}><article><span>{t("p302")}</span><h3>{t("p303")}</h3><p>{t("p304")}</p><a href={contact} className={styles.goldButton}>{t("p305")}</a></article></div><p className={styles.legal}>{t("p306")}</p></section>
  </div>;
}
