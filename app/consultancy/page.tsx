import Image from 'next/image';
import CaseStudies from './CaseStudies';
import {getTranslations} from 'next-intl/server';
import IntroCallForm from '../private-capital/IntroCallForm';
import PublicHeader from '../components/PublicHeader';
import HomeContactFooter from '../components/HomeContactFooter';
import ArrowUpRightIcon from '../components/ArrowUpRightIcon';
import {publicMetadata} from '../../i18n/metadata';
import styles from './page.module.css';

export async function generateMetadata() {
  const metadata = await publicMetadata('consultancy', '/consultancy');
  return {...metadata, openGraph: {...metadata.openGraph, images: ['/images/consultancy-gateway.png']},
    twitter: {...metadata.twitter, images: ['/images/consultancy-gateway.png']}};
}

export default async function ConsultancyPage() {
  const t = await getTranslations('Consultancy');
  const services = ['legal', 'estate', 'finance'] as const;
  return (
    <main className={styles.page}>
      <div className={styles.header}><PublicHeader /></div>
      <section className={styles.hero} aria-labelledby="consultancy-title">
        <Image src="/images/consultancy-gateway.png" alt="" fill priority sizes="100vw" className={styles.image} />
        <div className={styles.shade} />
        <div className={styles.heroCopy}>
          <p className={styles.eyebrow}>MZS GROUP <span aria-hidden="true">/</span> {t('label')}</p>
          <h1 id="consultancy-title">{t('headline')}</h1>
          <p className={styles.lead}>{t('lead')}</p>
        </div>
      </section>
      <nav className={styles.sectionNav} aria-label={t('label')}>
        {services.map((service, index) => <a href={`#${service}`} key={service}><span className={styles.number}>0{index + 1}</span>{t(`${service}Title`)}<ArrowUpRightIcon /></a>)}
      </nav>
      <section className={styles.services} aria-label={t('label')}>
        {services.map((service, index) => (
          <article id={service} className={styles.service} key={service} aria-labelledby={`${service}-title`}>
            <span className={styles.number}>0{index + 1}</span>
            <h2 id={`${service}-title`}>{t(`${service}Title`)}</h2>
            <p>{t(`${service}Body`)}</p>
          </article>
        ))}
      </section>
      {process.env.VERCEL_ENV === "preview" && <CaseStudies />}
      <IntroCallForm introduction={t('lead')} source="consultancy" sectionNumber={process.env.VERCEL_ENV === "preview" ? "05" : "04"} preview={process.env.VERCEL_ENV === "preview"} />
      <div className={styles.footer}><HomeContactFooter /></div>
    </main>
  );
}
