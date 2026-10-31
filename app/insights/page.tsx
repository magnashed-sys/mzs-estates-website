import type {Metadata} from 'next';
import Link from 'next/link';
import {getLocale,getTranslations} from 'next-intl/server';
import {languageAlternates} from '../../i18n/public-routing';
import PublicHeader from '../components/PublicHeader';
import HomeContactFooter from '../components/HomeContactFooter';
import {categories,INSIGHTS_DISCOVERABLE,insightPath} from '../../lib/insights/model';
import {listInsights} from '../../lib/insights/data';
import {insightsCopy} from '../../lib/insights/copy';
import Cards from './Cards';
import s from './insights.module.css';
export const dynamic='force-dynamic';
type Props={searchParams:Promise<Record<string,string|string[]|undefined>>};
export async function generateMetadata({searchParams}:Props):Promise<Metadata>{
 const locale=await getLocale(),q=await searchParams;
 return {title:'MZS Insights',description:insightsCopy(locale).intro,alternates:{canonical:insightPath(locale),languages:languageAlternates('/insights')},
  robots:{index:INSIGHTS_DISCOVERABLE&&process.env.VERCEL_ENV==='production'&&!Object.keys(q).length,follow:INSIGHTS_DISCOVERABLE&&process.env.VERCEL_ENV==='production'},
  openGraph:{title:'MZS Insights',description:insightsCopy(locale).intro,url:insightPath(locale)},twitter:{title:'MZS Insights',description:insightsCopy(locale).intro}};
}
export default async function InsightsPage({searchParams}:Props){
 const [locale,t,q]=await Promise.all([getLocale(),getTranslations('Header'),searchParams]);
 const c=insightsCopy(locale),category=typeof q.category==='string'&&(categories as readonly string[]).includes(q.category)?q.category:'';
 const region=typeof q.region==='string'?q.region.trim().slice(0,80):'';
 const page=typeof q.page==='string'&&/^\d+$/.test(q.page)?Math.min(10000,Math.max(1,Number(q.page))):1;
 const {items,count}=await listInsights(locale,page,category,region);
 const labels={'real-estate':t('real_estate'),'private-capital':t('private_capital'),consultancy:t('consultancy')};
 const pageHref=(n:number)=>insightPath(locale)+'?'+new URLSearchParams({...(category?{category}:{}),...(region?{region}:{}),page:String(n)});
 return <main className={s.page}><div className={s.header}><PublicHeader/></div><div className={s.wrap}>
  <section className={s.hero}><p className={s.eyebrow}>MZS GROUP / INSIGHTS</p><h1>MZS Insights<span>.</span></h1><p>{c.intro}</p></section>
  <form className={s.filters} action={insightPath(locale)}><label>{c.all}<select name="category" defaultValue={category}><option value="">{c.all}</option>{categories.map(k=><option key={k} value={k}>{labels[k]}</option>)}</select></label><label>{c.region}<input name="region" defaultValue={region} maxLength={80}/></label><button>{c.filter}</button></form>
  {items.length?<Cards items={items} labels={labels}/>:<div className={s.empty}><span aria-hidden="true">✧</span><p>{c.empty}</p>{(category||region||page>1)&&<Link href={insightPath(locale)}>{c.back}</Link>}</div>}
  <nav className={s.pagination} aria-label={c.next}>{page>1&&<Link href={pageHref(page-1)}>{c.previous}</Link>}{page*12<count&&<Link href={pageHref(page+1)}>{c.next}</Link>}</nav>
 </div><div className={s.footer}><HomeContactFooter/></div></main>;
}
