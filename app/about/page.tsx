import Image from 'next/image';
import {getTranslations} from 'next-intl/server';
import PublicHeader from '../components/PublicHeader';
import HomeContactFooter from '../components/HomeContactFooter';
import {publicMetadata} from '../../i18n/metadata';
import styles from './page.module.css';

export async function generateMetadata() {
  const metadata = await publicMetadata('about', '/about');
  return {...metadata, openGraph: {...metadata.openGraph, images: ['/images/about-journey.png']},
    twitter: {...metadata.twitter, images: ['/images/about-journey.png']}};
}

export default async function AboutPage() {
  const t = await getTranslations('About');
  return (
    <main className={styles.page}>
      <div className={styles.header}><PublicHeader /></div>
      <section className={styles.intro} aria-labelledby="about-title">
        <p className={styles.eyebrow}>{t('label')} <span aria-hidden="true">/</span> MZS GROUP</p>
        <h1 id="about-title">{t('headline')}</h1>
      </section>
      <figure className={styles.figure}>
        <div className={styles.panorama}>
          <Image src="/images/about-journey.png" alt={t('caption')} fill priority sizes="100vw" className={styles.image} />
        </div>
        <figcaption>{t('caption')}</figcaption>
      </figure>
      <section className={styles.story} aria-label={t('label')}>
        <ol className={styles.journey}>
          <li><span className={styles.number}>01</span><h2>{t('amsterdam')}</h2><span className={styles.year}>1990</span></li>
          <li><span className={styles.number}>02</span><h2>{t('spain')}</h2></li>
          <li><span className={styles.number}>03</span><h2>{t('dubai')}</h2></li>
        </ol>
        <p className={styles.body}>{t('body')}</p>
      </section>
      <div className={styles.footer}><HomeContactFooter /></div>
    </main>
  );
}
