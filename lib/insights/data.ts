import {cache} from 'react';
import {createClient} from '@supabase/supabase-js';
import {notFound} from 'next/navigation';
import {isPhase3aPreviewIsolated} from '../security/phase3a-preview-isolation';
import {cardFields, type Insight} from './model';

// Public reads never inherit an administrator's cookies or ability to see drafts.
function publicDb() {
  if (!isPhase3aPreviewIsolated()) notFound();
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
    auth: {persistSession:false, autoRefreshToken:false, detectSessionInUrl:false},
    global:{fetch:(url,init)=>fetch(url,{...init,cache:'no-store'})},
  });
}
export async function listInsights(locale: string, page = 1, category = '', region = '') {
  let query = publicDb().from('mzs_insights').select(cardFields,{count:'exact'}).eq('locale',locale)
    .eq('status','published').lte('publish_at',new Date().toISOString());
  if (category) query=query.eq('category',category);
  if (region) query=query.eq('region',region);
  const {data,error,count}=await query.order('publish_at',{ascending:false}).order('id').range((page-1)*12,page*12-1);
  if (error) throw new Error('Insights could not be loaded. Please try again.');
  return {items:(data||[]) as unknown as Insight[], count:count||0};
}
export const getInsight = cache(async(locale:string,slug:string)=>{
  const {data,error}=await publicDb().from('mzs_insights').select('*').eq('locale',locale).eq('slug',slug)
    .eq('status','published').lte('publish_at',new Date().toISOString()).maybeSingle();
  if(error) throw new Error('The article could not be loaded. Please try again.');
  return data as Insight|null;
});
export async function translations(articleId:string) {
  const {data,error}=await publicDb().from('mzs_insights').select('locale,slug').eq('article_id',articleId)
    .eq('status','published').lte('publish_at',new Date().toISOString());
  if(error) throw new Error('Translations could not be loaded.');
  return (data||[]) as Pick<Insight,'locale'|'slug'>[];
}
export async function relatedInsights(article:Insight) {
  const {data,error}=await publicDb().from('mzs_insights').select(cardFields).eq('locale',article.locale)
    .eq('category',article.category).neq('article_id',article.article_id).eq('status','published')
    .lte('publish_at',new Date().toISOString()).order('publish_at',{ascending:false}).limit(3);
  if(error) throw new Error('Related articles could not be loaded.');
  return (data||[]) as unknown as Insight[];
}
export async function sitemapInsights() {
  const items: Pick<Insight,'article_id'|'locale'|'slug'|'content_updated_on'>[]=[];
  for(let start=0;;start+=1000){
    const {data,error}=await publicDb().from('mzs_insights').select('article_id,locale,slug,content_updated_on')
      .eq('status','published').lte('publish_at',new Date().toISOString()).order('id').range(start,start+999);
    if(error) throw new Error('Insights sitemap could not be loaded.');
    items.push(...(data||[])); if(!data || data.length<1000) return items;
  }
}
