import type {MetadataRoute} from 'next';
import {locales, publicPaths, localizedPath, languageAlternates} from '../i18n/public-routing';
import {INSIGHTS_DISCOVERABLE,insightPath} from '../lib/insights/model';
import {sitemapInsights} from '../lib/insights/data';
export const dynamic='force-dynamic';
const origin = 'https://www.mzsgroup.com';
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  if (process.env.VERCEL_ENV !== 'production') return [];
  const pages:MetadataRoute.Sitemap=publicPaths.flatMap(path => locales.map(locale => ({
    url: origin + localizedPath(path, locale),
    alternates: {languages: Object.fromEntries(Object.entries(languageAlternates(path)).map(([language, url]) => [language, origin + url]))},
  })));
 if(!INSIGHTS_DISCOVERABLE) return pages;
 const articles=await sitemapInsights();
 const languages=[...new Set(articles.map(a=>a.locale))];
 for(const locale of languages)pages.push({url:origin+insightPath(locale)});
 for(const a of articles)pages.push({url:origin+insightPath(a.locale,a.slug),lastModified:a.content_updated_on,alternates:{languages:Object.fromEntries(articles.filter(b=>b.article_id===a.article_id).map(b=>[b.locale,origin+insightPath(b.locale,b.slug)]))}});
 return pages;
}
