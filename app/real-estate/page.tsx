import ArrowUpRightIcon from "../components/ArrowUpRightIcon";
import {localizedPath} from "../../i18n/public-routing";
import {publicMetadata} from "../../i18n/metadata";
export const generateMetadata = () => publicMetadata("estates", "/real-estate");
import {getLocale, getTranslations} from 'next-intl/server';
import Link from "next/link";
import Image from "next/image";
import IntroCallForm from "../private-capital/IntroCallForm";
import atmosphere from "../private-capital/atmosphere.module.css";
import estate from "./atmosphere.module.css";
import PublicHeader from "../components/PublicHeader";
import HomeContactFooter from "../components/HomeContactFooter";
import styles from "../public-introductions.module.css";




export default async function RealEstatePage() {
  const locale = await getLocale();
  const slogan = await getTranslations('Home');
  const t = await getTranslations('Estates');
const activities = [
  {
    number: "01",
    title: t('ownership_management'),
    subtitle: t('an_enduring_perspective'),
    description:
      t('managing_selected_privately_and_corporately_held'),
  },
  {
    number: "02",
    title: t('private_rentals_sales'),
    subtitle: t('a_personal_approach'),
    description:
      t('presenting_selected_residential_properties_for_private'),
  },
  {
    number: "03",
    title: t('development_investment'),
    subtitle: t('opportunities_with_purpose'),
    description:
      t('evaluating_development_projects_and_strategic_real'),
  },
];
  const preview = process.env.VERCEL_ENV === "preview" && process.env.NEXT_PUBLIC_SUPABASE_URL === "https://senonkpxdtlhyhrubicg.supabase.co";
  return (
    <main className={`${styles.page} ${atmosphere.page}`}>
      <div className={styles.headerWrap}><PublicHeader /></div>
      <section className={`${styles.hero} ${atmosphere.hero}`} aria-labelledby="estates-heading">
        <div className={atmosphere.heroImage} aria-hidden="true"><Image src="/mzs-hero.png" alt="" fill priority sizes="100vw" /><div className={atmosphere.heroShade} /></div>
        <div className={styles.heroContent}>
          <p className={styles.eyebrow}>{t('mzs_estates_real_estate')}</p>
          <h1 id="estates-heading">{t('private_real_estate')}<br /><em>{t('international_perspective')}</em></h1>
          <div className={styles.rule} aria-hidden="true" />
          <p className={styles.heroLead}> {t('an_independent_approach_to_selected_property')} </p>
          <nav className={atmosphere.sectionNavigation} aria-label={t('explore_real_estate')}>
            <a href="#estates-perspective">{t('our_perspective')} <span aria-hidden="true"><ArrowUpRightIcon /></span></a>
            <a href="#activities">{t('our_activities')} <span aria-hidden="true"><ArrowUpRightIcon /></span></a>
            <a href="#international-reach">{t('international_reach')} <span aria-hidden="true"><ArrowUpRightIcon /></span></a>
            <a href="#introductory-call">{t('introductory_call')} <span aria-hidden="true"><ArrowUpRightIcon /></span></a>
          </nav>
        </div>
        <p className={styles.heroSideNote}>{slogan('sloganPrivate')} {slogan('sloganIndependent')} {slogan('sloganInternational')}</p>
      </section>

      <section id="estates-perspective" className={styles.introduction} aria-labelledby="estates-intro">
        <p className={styles.eyebrow}>{t('our_perspective_01')}</p>
        <div className={styles.introColumns}>
          <h2 id="estates-intro">{t('real_estate_with')} <em>{t('a_longterm_view')}</em></h2>
          <div className={styles.introBody}>
            <p> {t('mzs_estates_is_an_independent_international')} </p>
            <p> {t('our_activities_encompass_residential_and_investment')} </p>
          </div>
        </div>
      </section>

      <section id="activities" className={styles.activities} aria-labelledby="estates-activities">
        <div className={styles.sectionHeading}>
          <p className={styles.eyebrow}>{t('what_we_do_02')}</p>
          <h2 id="estates-activities">{t('our_activities_2')}</h2>
        </div>
        <div className={styles.activityGrid}>
          {activities.map((item) => (
            <article className={styles.activity} key={item.number}>
              <span className={styles.number}>{item.number}</span>
              <p className={styles.activitySubtitle}>{item.subtitle}</p>
              <h3>{item.title}</h3>
              <p>{item.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section id="international-reach" className={`${styles.presence} ${atmosphere.approach}`} aria-labelledby="estates-presence">
        {<figure className={atmosphere.conversationImage}><Image src="/images/capital/mediterranean-light.webp" alt={t('illustrative_mediterranean_stone_architecture_overlooking_the')} fill sizes="(max-width: 850px) 100vw, 50vw" /><figcaption>{t('a_sense_of_place_a_longterm')}</figcaption></figure>}
        <div className={atmosphere.approachCopy}>
        <p className={styles.eyebrow}>{t('international_reach_03')}</p>
        <div>
          <h2 id="estates-presence">{t('local_knowledge')}<br /><em>{t('international_outlook')}</em></h2>
          <p>{t('selected_activity_across_the_netherlands_spain')}</p>
          {<p className={estate.regions}>{t('the_netherlands_spain_uae')}</p>}
        </div>
        </div>
      </section>

      <IntroCallForm preview={preview} source="real-estate" sectionNumber="04" />
      {<p className={atmosphere.imageNote}>{t('illustrative_atmosphere_imagery')}</p>}

      <div className={styles.bottomNavigation}>
        <Link href={localizedPath("/", locale)}>{t('mzs_group')}</Link>
        <Link href={localizedPath("/private-capital", locale)}>{t('explore_private_capital')}</Link>
      </div>
      <div className={styles.footerWrap}><HomeContactFooter /></div>
    </main>
  );
}
