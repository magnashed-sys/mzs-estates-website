import type {MetadataRoute} from 'next';
import {locales, publicPaths, localizedPath, languageAlternates} from '../i18n/public-routing';
const origin = 'https://www.mzsgroup.com';
export default function sitemap(): MetadataRoute.Sitemap {
  if (process.env.VERCEL_ENV !== 'production') return [];
  return publicPaths.flatMap(path => locales.map(locale => ({
    url: origin + localizedPath(path, locale),
    alternates: {languages: Object.fromEntries(Object.entries(languageAlternates(path)).map(([language, url]) => [language, origin + url]))},
  })));
}
