"use client";
import {useTranslations} from 'next-intl';
import styles from "./HomeContactFooter.module.css";

// Prepared component only: do not wire into app/page.tsx until the homepage
// source and the public contact email have been confirmed. No default address.
type Props = { email: string };

export default function HomeContactFooter({ email }: Props) {
  const t = useTranslations('Footer');
  const navigation = useTranslations('Header');
  const address = email.trim();
  if (!/^[^\s@?:]+@[^\s@?:]+\.[^\s@?:]+$/.test(address)) {
    throw new Error("Configure the confirmed public MZS contact email.");
  }
  return (
    <footer className={styles.footer}>
      <span className={styles.locations}>AMSTERDAM · IBIZA · DUBAI</span>
      <div className={styles.links}>
      <a className={styles.contact} href={`mailto:${address}`} aria-label={t("contactEmail", {address})}>
        <span>{t('contact_mzs')}</span><span aria-hidden="true">↗</span>
      </a>
      <a className={styles.contact} href="/request-access">
        <span>{navigation('request_access')}</span><span aria-hidden="true">↗</span>
      </a>
      </div>
      <span className={styles.invitation}>{t('private_access')}</span>
    </footer>
  );
}
