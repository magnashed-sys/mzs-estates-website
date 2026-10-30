import {randomUUID} from 'node:crypto';
import Link from 'next/link';
import {notFound,redirect} from 'next/navigation';
import {requireEstateAdmin} from '../../../../lib/security/estate-properties';
import {getAdminI18n} from '../../../../lib/admin/i18n-server';
import {isLocale} from '../../../../i18n/public-routing';
import type {Insight} from '../../../../lib/insights/model';
import Editor from '../Editor';
import s from '../admin.module.css';
export default async function NewInsight({searchParams}:{searchParams:Promise<{article?:string;locale?:string}>}){
 const {db}=await requireEstateAdmin();const [{language},q]=await Promise.all([getAdminI18n(),searchParams]);let base:Partial<Insight>={};
 const locale=isLocale(q.locale)?q.locale:'en';
 if(q.article){
  if(!/^[a-f0-9-]{36}$/i.test(q.article))notFound();
  const {data,error}=await db.from('mzs_insights').select('id,article_id,locale,category,region,format,author,sources').eq('article_id',q.article).limit(24);
  if(error)throw new Error('Translations could not be loaded.');if(!data?.length)notFound();
  const existing=data.find(a=>a.locale===locale);if(existing)redirect('/admin/insights/'+existing.id);
  base=data[0];
 }
 const article:Insight={id:randomUUID(),article_id:q.article||randomUUID(),locale,slug:'',title:'',summary:'',body:'',category:base.category||'real-estate',format:base.format||'article',region:base.region||'',author:base.author||'',sources:base.sources||[],seo_title:'',seo_description:'',status:'draft',publish_at:null,content_updated_on:new Date().toISOString().slice(0,10),updated_at:'',revision:0};
 return <main className={s.page}><Link href="/admin/insights">← MZS Insights</Link><h1>{language==='es'?'Nuevo artículo':'New article'}</h1><Editor article={article} es={language==='es'}/></main>;
}
