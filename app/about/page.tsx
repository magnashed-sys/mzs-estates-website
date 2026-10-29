import {getWorkCopy} from './work-copy';
import IntroCallForm from '../private-capital/IntroCallForm';
import CaseStudies from '../consultancy/CaseStudies';
import Image from 'next/image';
import Link from 'next/link';
import ArrowUpRightIcon from '../components/ArrowUpRightIcon';
import {localizedPath} from '../../i18n/public-routing';
import {getLocale, getTranslations} from 'next-intl/server';
import PublicHeader from '../components/PublicHeader';
import HomeContactFooter from '../components/HomeContactFooter';
import {publicMetadata} from '../../i18n/metadata';
import styles from './page.module.css';

export const generateMetadata = () => publicMetadata('about', '/about');

export default async function AboutPage() {
  const [t, header, estates, locale] = await Promise.all([getTranslations('About'), getTranslations('Header'), getTranslations('Estates'), getLocale()]);
  const work = getWorkCopy(locale);
  const activities = [
    {href: '/consultancy', label: header('consultancy'), introduction: t('consultancy_intro')},
    {href: '/real-estate', label: header('real_estate'), introduction: t('real_estate_intro')},
    {href: '/private-capital', label: header('private_capital'), introduction: t('private_capital_intro')},
  ];
  return (
    <main className={styles.page}>
      <div className={styles.header}><PublicHeader /></div>
      <section className={styles.intro} aria-labelledby="about-title">
        <p className={styles.eyebrow}>{t('label')} <span aria-hidden="true">/</span> MZS GROUP</p>
        <h1 id="about-title">{t('headline')}</h1>
        <p className={styles.positioning}>{t('positioning')}</p>
      </section>
      <figure className={styles.figure}>
        <div className={styles.panorama}>
          <Image src="/images/about-journey.png" alt={t('caption')} fill priority sizes="100vw" className={styles.image} />
        </div>
      </figure>
      <section className={styles.story} aria-label={t('label')}>
        <ol className={styles.journey}>
          <li><span className={styles.number}>01</span><h2>{t('amsterdam')}</h2><span className={styles.year}>1990</span></li>
          <li><span className={styles.number}>02</span><h2>{t('spain')}</h2></li>
          <li><span className={styles.number}>03</span><h2>{t('dubai')}</h2></li>
        </ol>
        <div className={styles.storyContent}>
          <figure className={styles.historyPhoto}>
            <Image src="/images/about-bazaar.webp" alt="De Bazaar, Beverwijk" width={1250} height={544} sizes="(max-width: 850px) 100vw, 48vw" />
          </figure>
          <p className={styles.body}>{t('body')}</p>
        </div>
      </section>
      <section className={styles.activities} aria-labelledby="about-activities">
        <h2 id="about-activities">{estates('our_activities_2')}</h2>
        <div className={styles.activityGrid}>
          {activities.map((activity, index) => (
            <Link className={styles.activityCard} href={localizedPath(activity.href, locale)} key={activity.href}>
              <div className={styles.activityHeading}>
                <h3 className={styles.activityTitle}>{activity.label}</h3>
                <span className={styles.number} aria-hidden="true">0{index + 1}</span>
              </div>
              <p className={styles.activityIntroduction}>{activity.introduction}</p>
              <span className={styles.activityArrow} aria-hidden="true"><ArrowUpRightIcon /></span>
            </Link>
          ))}
        </div>
      </section>
      <section className={styles.workGrid} aria-label={work.sectionLabel}>
        <article className={styles.workCard} aria-labelledby="work-with-title">
          <p className={styles.eyebrow}>{work.partnerEyebrow}</p>
          <h2 id="work-with-title">{work.partnerTitle}</h2>
          <p className={styles.workLead}>{work.partnerLead}</p>
          <p>{work.partnerBody}</p>
          <p>{work.partnerInvitation}</p>
          <Link className={styles.workAction} href={localizedPath('/request-access', locale)}>{work.partnerAction} <ArrowUpRightIcon /></Link>
        </article>
        <article className={styles.workCard} aria-labelledby="work-for-title">
          <p className={styles.eyebrow}>{work.careerEyebrow}</p>
          <h2 id="work-for-title">{work.careerTitle}</h2>
          <p className={styles.workLead}>{work.careerLead}</p>
          <p>{work.careerBody}</p>
          <ul className={styles.workLanguages}>{work.languages.map(language => <li key={language}>{language}</li>)}</ul>
          <p>{work.careerInvitation}</p>
          <a className={styles.workAction} href="#introductory-call">{work.careerAction} <ArrowUpRightIcon /></a>
        </article>
      </section>
      <CaseStudies />
      <IntroCallForm introduction="" source="consultancy" sectionNumber="05" preview={process.env.VERCEL_ENV === "preview"} />
      <div className={styles.footer}><HomeContactFooter /></div>
    </main>
  );
}
