"use client";
import {useLocale} from 'next-intl';
import LanguageSwitcher from "./LanguageSwitcher";
import styles from "./HomeContactFooter.module.css";

/** Keep Amsterdam as a city; show Spain and UAE in each available language. */
const spainLabels: Record<string, string> = {

  "da": "SPANIEN",
  "uk": "ІСПАНІЯ",
  "fi": "ESPANJA",
  "cs": "ŠPANĚLSKO"
,

  en: "SPAIN",
  tr: "İSPANYA",
  nl: "SPANJE",
  es: "ESPAÑA",
  de: "SPANIEN",
  it: "SPAGNA",
  fr: "ESPAGNE",
  ru: "ИСПАНИЯ",
  "pt-BR": "ESPANHA",
  ar: "إسبانيا",
  lt: "ISPANIJA",
  pl: "HISZPANIA", "zh-CN": "西班牙", sv: "SPANIEN", ro: "SPANIA", nb: "SPANIA",
};

const uaeLabels: Record<string, string> = {

  "da": "DE FORENEDE ARABISKE EMIRATER",
  "uk": "ОАЕ",
  "fi": "ARABIEMIIRIKUNNAT",
  "cs": "SAE"
,

  en: "UAE",
  tr: "BAE",
  nl: "VAE",
  es: "EAU",
  de: "VAE",
  it: "EAU",
  fr: "EAU",
  ru: "ОАЭ",
  "pt-BR": "EAU",
  ar: "الإمارات العربية المتحدة",
  lt: "JAE",
  pl: "ZEA", "zh-CN": "阿联酋", sv: "FÖRENADE ARABEMIRATEN", ro: "EAU", nb: "DE FORENTE ARABISKE EMIRATER",
};

export default function HomeContactFooter() {
  const locale = useLocale();
  return (
    <footer className={styles.footer}>
      <span className={styles.locations}>AMSTERDAM · {spainLabels[locale] ?? "SPAIN"} · {uaeLabels[locale] ?? "UAE"}</span>
      <div className={styles.languages}><LanguageSwitcher inline /></div>
    </footer>
  );
}

