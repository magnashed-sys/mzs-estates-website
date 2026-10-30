import type {Metadata} from 'next';
import {getLocale, getTranslations} from 'next-intl/server';
import {languageAlternates, localizedPath} from './public-routing';
export async function publicMetadata(page: 'home' | 'estates' | 'capital' | 'about' | 'consultancy', path: string): Promise<Metadata> {
  const locale = await getLocale();
  const t = await getTranslations('Metadata');
  const title = t(`${page}Title`), description = t(`${page}Description`);
  const image = {url: `/images/social/${page === 'consultancy' ? 'consultancy' : page === 'about' ? 'about' : page === 'capital' ? 'capital' : 'group'}.jpg`, width: 1200, height: 630, alt: title};
  return {
    title: {absolute: title}, description,
    alternates: {canonical: localizedPath(path, locale), languages: languageAlternates(path)},
    robots: {index: process.env.VERCEL_ENV === 'production', follow: process.env.VERCEL_ENV === 'production'},
    openGraph: {title, description, url: localizedPath(path, locale), siteName: 'MZS Group', type: 'website', locale: {en: 'en_GB', nl: 'nl_NL', es: 'es_ES', ru: 'ru_RU', de: 'de_DE', it: 'it_IT', fr: 'fr_FR', 'pt-BR': 'pt_BR', ar: 'ar_AR', tr: 'tr_TR', lt: 'lt_LT', pl: 'pl_PL', 'zh-CN': 'zh_CN', sv: 'sv_SE', ro: 'ro_RO', nb: 'nb_NO', da: 'da_DK', uk: 'uk_UA', fi: 'fi_FI', cs: 'cs_CZ'}[locale], images: [image]},
    twitter: {card: 'summary_large_image', title, description, images: [image.url]},
  };
}
