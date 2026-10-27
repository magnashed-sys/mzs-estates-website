import OrganizationData from "./components/OrganizationData";
import {preload} from "react-dom";
import {publicMetadata} from "../i18n/metadata";
export const generateMetadata = () => publicMetadata("home", "/");
import {getTranslations} from 'next-intl/server';
import PublicHeader from "./components/PublicHeader";
import HomeContactFooter from "./components/HomeContactFooter";
import polish from "./homepage-polish.module.css";
import "./homepage-refinements.css";

export default async function Home() {
  const t = await getTranslations('Home');
  preload('/images/home-hero-960.webp', {as: 'image', media: '(max-width: 700px)'});
  preload('/images/home-hero-1536.webp', {as: 'image', media: '(min-width: 701px)'});
  return (
    <main className={`mzs-home mzs-home-image mzs-home-refined ${polish.home}`}>
      <OrganizationData />
      <PublicHeader />

      <section className="mzs-hero">
        <h1>
          {t('sloganPrivate')}
          <br />
          {t('sloganIndependent')}
          <br />
          {t('sloganInternational')}
        </h1>

        <div className="mzs-separator" aria-hidden="true" />

        <p className="mzs-intro"> {t('mzs_group_is_an_independent_international')} </p>
      </section>

      <HomeContactFooter />
    </main>
  );
}
