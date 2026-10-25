import {publicMetadata} from "../i18n/metadata";
export const generateMetadata = () => publicMetadata("home", "/");
import {getTranslations} from 'next-intl/server';
import PublicHeader from "./components/PublicHeader";
import HomeContactFooter from "./components/HomeContactFooter";
import polish from "./homepage-polish.module.css";
import "./homepage-refinements.css";

export default async function Home() {
  const t = await getTranslations('Home');
  return (
    <main className={`mzs-home mzs-home-image mzs-home-refined ${polish.home}`}>
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

      <HomeContactFooter email="info@mzsgroup.eu" />
    </main>
  );
}
