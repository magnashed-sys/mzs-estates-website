import OrganizationData from "./components/OrganizationData";
import {preload} from "react-dom";
import {publicMetadata} from "../i18n/metadata";
export const generateMetadata = () => publicMetadata("home", "/");
import {getLocale, getTranslations} from 'next-intl/server';
import Link from 'next/link';
import {localizedPath} from '../i18n/public-routing';
import ArrowUpRightIcon from './components/ArrowUpRightIcon';
import PublicHeader from "./components/PublicHeader";
import HomeContactFooter from "./components/HomeContactFooter";
import polish from "./homepage-polish.module.css";
import "./homepage-refinements.css";

export default async function Home() {
  const [t, header, estates, locale] = await Promise.all([
    getTranslations('Home'), getTranslations('Header'), getTranslations('Estates'), getLocale(),
  ]);
  const activities = [
    {href: '/consultancy', label: header('consultancy')},
    {href: '/real-estate', label: header('real_estate')},
    {href: '/private-capital', label: header('private_capital')},
  ];
  preload('/images/home-hero-960.webp', {as: 'image', media: '(max-width: 700px)'});
  preload('/images/home-hero-1536.webp', {as: 'image', media: '(min-width: 701px)'});
  return (
    <main className={`mzs-home mzs-home-image mzs-home-refined ${polish.home}`}>
      <OrganizationData />
      <PublicHeader />

      <section className="mzs-hero" aria-labelledby="home-heading">
        <h1 id="home-heading">{t('headline')}</h1>

        <div className="mzs-separator" aria-hidden="true" />

        <p className="mzs-intro"> {t('mzs_group_is_an_independent_international')} </p>
        <p className={polish.brandPromise}>
          <span>{t('sloganPrivate')}</span>{' '}
          <span>{t('sloganIndependent')}</span>{' '}
          <span>{t('sloganInternational')}</span>
        </p>
        <nav className={polish.activities} aria-label={estates('our_activities_2')}>
          {activities.map(activity => (
            <Link href={localizedPath(activity.href, locale)} key={activity.href}>
              {activity.label}<ArrowUpRightIcon />
            </Link>
          ))}
        </nav>
      </section>

      <HomeContactFooter />
    </main>
  );
}
