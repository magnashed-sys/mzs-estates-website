import type {Metadata} from 'next';
import Link from 'next/link';
import {notFound} from 'next/navigation';
import {getLocale,getTranslations} from 'next-intl/server';
import {locales,localizedPath} from '../../../i18n/public-routing';
import PublicHeader from '../../components/PublicHeader';
import HomeContactFooter from '../../components/HomeContactFooter';
import IntroCallForm from '../../private-capital/IntroCallForm';
import {getInsight,translations,relatedInsights} from '../../../lib/insights/data';
import {insightPath,INSIGHTS_DISCOVERABLE,safeSource} from '../../../lib/insights/model';
import {insightsCopy} from '../../../lib/insights/copy';
import Content from '../Content';
import Cards from '../Cards';
import s from '../insights.module.css';
export const dynamic='force-dynamic';
type Props={params:Promise<{slug:string}>};
export async function generateMetadata({params}:Props):Promise<Metadata>{
 const locale=await getLocale(),{slug}=await params,a=await getInsight(locale,slug);
 if(!a) return {title:'MZS Insights',robots:{index:false,follow:false},alternates:{canonical:insightPath(locale)}};
 const variants=await translations(a.article_id),title=a.seo_title||a.title,description=a.seo_description||a.summary,url=insightPath(locale,a.slug);
 return {title,description,alternates:{canonical:url,languages:Object.fromEntries(variants.map(v=>[v.locale,insightPath(v.locale,v.slug)]))},
  robots:{index:INSIGHTS_DISCOVERABLE&&process.env.VERCEL_ENV==='production',follow:INSIGHTS_DISCOVERABLE},
  openGraph:{type:'article',title,description,url,publishedTime:a.publish_at!,modifiedTime:a.content_updated_on,authors:[a.author],locale},
  twitter:{title,description}};
}
export default async function ArticlePage({params}:Props){
 const [locale,t,{slug}]=await Promise.all([getLocale(),getTranslations('Header'),params]);
 const a=await getInsight(locale,slug);if(!a) notFound();
 const [variants,related]=await Promise.all([translations(a.article_id),relatedInsights(a)]),c=insightsCopy(locale);
 const labels={'real-estate':t('real_estate'),'private-capital':t('private_capital'),consultancy:t('consultancy')};
 const languageLinks=Object.fromEntries(locales.flatMap(l=>variants.filter(v=>v.locale===l).map(v=>[v.locale,insightPath(v.locale,v.slug)])));
 const schema={'@context':'https://schema.org','@type':'Article',headline:a.title,description:a.summary,inLanguage:a.locale,
  datePublished:a.publish_at,dateModified:a.content_updated_on,author:{'@type':'Person',name:a.author},publisher:{'@type':'Organization',name:'MZS Group'},mainEntityOfPage:'https://www.mzsgroup.com'+insightPath(locale,a.slug)};
 return <main className={s.page}><div className={s.header}><PublicHeader languageLinks={languageLinks}/></div><div className={s.wrap}>
  <Link className={s.back} href={insightPath(locale)}>← {c.back}</Link>
  <article className={s.article}>
   <header><p className={s.eyebrow}>{labels[a.category]}{a.region&&<> · {a.region}</>}</p><h1>{a.title}</h1><p className={s.lead}>{a.summary}</p><p className={s.byline}>{a.author} · {c.updated} <time dateTime={a.content_updated_on}>{new Intl.DateTimeFormat(locale,{dateStyle:'long',timeZone:'UTC'}).format(new Date(a.content_updated_on))}</time></p></header>
   <div className={s.prose}><Content body={a.body}/></div>
   {!!a.sources.length&&<section className={s.sources}><h2>{c.sources}</h2><ul>{a.sources.filter(u=>safeSource(u)).map(u=><li key={u}><a href={u} rel="noopener noreferrer" target="_blank">{u}</a></li>)}</ul></section>}
   <div className={s.cta}><Link href={localizedPath('/'+a.category,locale)}>{labels[a.category]} ↗</Link><a href="#introductory-call">{c.contact} ↗</a></div>
  </article>
  {!!related.length&&<section className={s.related}><h2>{c.related}</h2><Cards items={related} labels={labels}/></section>}
 </div><div className={s.contact}><IntroCallForm source={a.category} preview={process.env.VERCEL_ENV==='preview'} sectionNumber="" introduction={c.contact}/></div><div className={s.footer}><HomeContactFooter/></div>
 <script type="application/ld+json" dangerouslySetInnerHTML={{__html:JSON.stringify(schema).replace(/</g,'\\u003c')}}/>
 </main>;
}
