import CaseStudies from '../consultancy/CaseStudies';
import ArrowUpRightIcon from "../components/ArrowUpRightIcon";
import {localizedPath} from "../../i18n/public-routing";
import {publicMetadata} from "../../i18n/metadata";
export const generateMetadata = () => publicMetadata("capital", "/private-capital");
import {getLocale, getTranslations} from 'next-intl/server';
import Link from "next/link";
import Image from "next/image";
import atmosphere from "./atmosphere.module.css";
import PublicHeader from "../components/PublicHeader";
import HomeContactFooter from "../components/HomeContactFooter";
import styles from "../public-introductions.module.css";
import IntroCallForm from "./IntroCallForm";
import { introCallsEnvironmentAllowed } from "../../lib/mzs/intro-calls";




export default async function PrivateCapitalPage() {
  const locale = await getLocale();
  const slogan = await getTranslations('Home');
  const t = await getTranslations('Capital');
const focus = [
  {
    number: "01",
    title: t('private_financing'),
    subtitle: t('capital_with_perspective'),
    description:
      t('considering_privately_structured_financing_opportunities_including'),
  },
  {
    number: "02",
    title: t('private_investments'),
    subtitle: t('selected_opportunities'),
    description:
      t('exploring_private_investment_opportunities_in_real'),
  },
  {
    number: "03",
    title: t('strategic_partnerships'),
    subtitle: t('relationships_that_matter'),
    description:
      t('working_with_selected_parties_on_potential'),
  },
];
  const introCallEnabled = introCallsEnvironmentAllowed();
  const atmosphereEnabled = introCallEnabled;
  return (
    <main className={`${styles.page} ${atmosphereEnabled ? atmosphere.page : ""}`}>
      <div className={styles.headerWrap}><PublicHeader /></div>
      <section className={`${styles.hero} ${atmosphereEnabled ? atmosphere.hero : ""}`} aria-labelledby="capital-heading">
        {atmosphereEnabled ? <div className={atmosphere.heroImage} aria-hidden="true"><Image src="/images/capital/mediterranean-light.webp" alt="" fill priority sizes="100vw" /><div className={atmosphere.heroShade} /></div> : <div className={styles.capitalImage} aria-hidden="true" />}
        <div className={styles.heroContent}>
          <p className={styles.eyebrow}>{t('mzs_capital_private_capital')}</p>
          <h1 id="capital-heading">{t('independent_capital')}<br /><em>{t('private_opportunities')}</em></h1>
          <div className={styles.rule} aria-hidden="true" />
          <p className={styles.heroLead}> {t('a_discreet_and_relationshipdriven_perspective_on')} </p>
          {atmosphereEnabled ? <nav className={atmosphere.sectionNavigation} aria-label={t('explore_private_capital')}>
            <a href="#capital-perspective">{t('our_perspective')} <span aria-hidden="true"><ArrowUpRightIcon /></span></a>
            <a href="#capital-focus">{t('our_focus')} <span aria-hidden="true"><ArrowUpRightIcon /></span></a>
            <a href="#capital-method">{t('our_approach')} <span aria-hidden="true"><ArrowUpRightIcon /></span></a>
            <a href="#capital-securities">{t('securities')} <span aria-hidden="true"><ArrowUpRightIcon /></span></a>
            <a href="#introductory-call">{t('introductory_call')} <span aria-hidden="true"><ArrowUpRightIcon /></span></a>
          </nav> : <div className={styles.heroActions}>
            {!atmosphereEnabled && (introCallEnabled ? (
              <a className={styles.primaryAction} href="#introductory-call">{t('request_an_introductory_call')} <span aria-hidden="true"><ArrowUpRightIcon /></span></a>
            ) : (
              <a className={styles.primaryAction} href="/request-access">{t('request_private_access')} <span aria-hidden="true"><ArrowUpRightIcon /></span></a>
            ))}
            <a className={styles.quietAction} href="#capital-focus">{t('discover_our_focus')} <span aria-hidden="true">↓</span></a>
          </div>}
        </div>
        <p className={styles.heroSideNote}>{slogan('sloganPrivate')} {slogan('sloganIndependent')} {slogan('sloganInternational')}</p>
      </section>

      <section id="capital-perspective" className={styles.introduction} aria-labelledby="capital-intro">
        <p className={styles.eyebrow}>{t('our_perspective_01')}</p>
        <div className={styles.introColumns}>
          <h2 id="capital-intro">{t('capital_guided_by')} <em>{t('relationships')}</em></h2>
          <div className={styles.introBody}>
            <p> {t('mzs_capital_focuses_on_private_investment')} </p>
            <p> {t('our_independent_approach_includes_both_grouprelated')} </p>
          </div>
        </div>
      </section>

      <section id="capital-focus" className={styles.activities} aria-labelledby="capital-activities">
        <div className={styles.sectionHeading}>
          <p className={styles.eyebrow}>{t('our_focus_02')}</p>
          <h2 id="capital-activities">{t('private_by_nature')}</h2>
        </div>
        <div className={styles.activityGrid}>
          {focus.map((item) => (
            <article className={styles.activity} key={item.number}>
              <span className={styles.number}>{item.number}</span>
              <p className={styles.activitySubtitle}>{item.subtitle}</p>
              <h3>{item.title}</h3>
              <p>{item.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section id="capital-method" className={`${styles.presence} ${atmosphereEnabled ? atmosphere.approach : ""}`} aria-labelledby="capital-approach">
        {atmosphereEnabled && <figure className={atmosphere.conversationImage}><Image src="/images/capital/personal-conversation.webp" alt={t('an_illustrative_sunlit_setting_for_a')} fill sizes="(max-width: 850px) 100vw, 48vw" /><figcaption>{t('space_for_a_personal_perspective')}</figcaption></figure>}
        <div className={atmosphereEnabled ? atmosphere.approachCopy : atmosphere.unwrap}>
        <p className={styles.eyebrow}>{t('our_approach_03')}</p>
        <div>
          <h2 id="capital-approach">{t('discretion_first')}<br /><em>{t('independent_thinking')}</em></h2>
          <p>{t('every_relationship_financing_enquiry_and_opportunity')}</p>
        </div>
        </div>
      </section>

      {atmosphereEnabled && <section id="capital-securities" className={`${styles.activities} ${atmosphere.securities}`} aria-labelledby="securities-heading">
        <div className={styles.sectionHeading}>
          <p className={styles.eyebrow}>{t('securities_04')}</p>
          <h2 id="securities-heading">{t('securities')}</h2>
          <p className={atmosphere.securityIntro}>{t('a_considered_security_structure_is_an')}</p>
        </div>
        <div className={styles.activityGrid}>
          <article className={styles.activity}>
            <span className={styles.number}>01</span>
            <p className={styles.activitySubtitle}>{t('personal_commitment')}</p>
            <h3>{t('personal_guarantees')}</h3>
            <p>{t('a_personal_guarantee_may_form_part')}</p>
          </article>
          <article className={styles.activity}>
            <span className={styles.number}>02</span>
            <p className={styles.activitySubtitle}>{t('real_estate_security')}</p>
            <h3>{t('mortgage_rights')}</h3>
            <p>{t('financing_may_be_secured_by_a')}</p>
          </article>
          <article className={styles.activity}>
            <span className={styles.number}>03</span>
            <p className={styles.activitySubtitle}>{t('share_security')}</p>
            <h3>{t('share_pledges')}</h3>
            <p>{t('a_pledge_over_shares_in_a')}</p>
          </article>
        </div>
      </section>}

      <CaseStudies sectionNumber={atmosphereEnabled ? "05" : "04"} />
      {introCallEnabled ? <IntroCallForm sectionNumber={atmosphereEnabled ? "06" : "05"} preview={process.env.VERCEL_ENV === "preview"} /> : <section className={styles.invitation} aria-labelledby="capital-invitation">
        <p className={styles.eyebrow}>{t('selected_private_access')}</p>
        <h2 id="capital-invitation">{t('a_confidential_conversation')}<br />{t('starts_here')}</h2>
        <p> {t('authorized_clients_and_partners_can_view')} </p>
        <div className={styles.heroActions}>
          <a className={styles.primaryAction} href="/login">{t('client_partner_login')} <span aria-hidden="true"><ArrowUpRightIcon /></span></a>
          <a className={styles.quietAction} href="/request-access">{t('request_access')} <span aria-hidden="true"><ArrowUpRightIcon /></span></a>
        </div>
        <p className={styles.disclaimer}> {t('information_on_this_page_is_introductory')} </p>
      </section>}
      {atmosphereEnabled && <p className={atmosphere.imageNote}>{t('illustrative_atmosphere_imagery')}</p>}
      <div className={styles.bottomNavigation}>
        <Link href={localizedPath("/", locale)}>{t('mzs_group')}</Link>
        <Link href={localizedPath("/real-estate", locale)}>{t('explore_real_estate')}</Link>
      </div>
      <div className={styles.footerWrap}><HomeContactFooter /></div>
    </main>
  );
}
