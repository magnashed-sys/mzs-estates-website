"use client";
import ArrowUpRightIcon from "./ArrowUpRightIcon";
import {useLocale, useTranslations} from 'next-intl';
import LanguageSwitcher from "./LanguageSwitcher";
import styles from "./HomeContactFooter.module.css";

type Props = { email: string };

/** Localized country label; the two city labels intentionally remain unchanged. */
const spainLabels: Record<string, string> = {
  en: "SPAIN",
  nl: "SPANJE",
  es: "ESPAÑA",
  de: "SPANIEN",
  it: "SPAGNA",
  fr: "ESPAGNE",
  ru: "ИСПАНИЯ",
  "pt-BR": "ESPANHA",
  ar: "إسبانيا",
};

export default function HomeContactFooter({ email }: Props) {
  const t = useTranslations('Footer');
  const locale = useLocale();
  const navigation = useTranslations('Header');
  const address = email.trim();
  if (!/^[^\s@?:]+@[^\s@?:]+\.[^\s@?:]+$/.test(address)) {
    throw new Error("Configure the confirmed public MZS contact email.");
  }
  return (
    <footer className={styles.footer}>
      <span className={styles.locations}>AMSTERDAM · {spainLabels[locale] ?? "SPAIN"} · DUBAI</span>
      <div className={styles.languages}><LanguageSwitcher inline /></div>
      <div className={styles.links}>
      <a className={styles.contact} href={`mailto:${address}`} aria-label={t("contactEmail", {address})}>
        <span>{t('contact_mzs')}</span><span aria-hidden="true"><ArrowUpRightIcon /></span>
      </a>
      <a className={styles.contact} href="/request-access" aria-label={navigation("request_access")}>
        <span>{navigation('request_access')}</span><span aria-hidden="true"><ArrowUpRightIcon /></span>
      </a>
      </div>
    </footer>
  );
}
