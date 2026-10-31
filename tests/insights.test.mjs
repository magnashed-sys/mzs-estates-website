import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';import ts from 'typescript';import path from 'node:path';import {createRequire} from 'node:module';import {execFileSync} from 'node:child_process';
const require=createRequire(import.meta.url),cache=new Map();
function load(file,overrides={},environment='production'){if(!Object.keys(overrides).length&&cache.has(file))return cache.get(file);const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText,{exports,Date,URL,FormData,Number,Math,Error,Intl,JSON,process:{env:{VERCEL_ENV:environment}},require:n=>overrides[n]||(n.startsWith('.')?load(path.join(path.dirname(file),n+'.ts')):require(n))});if(!Object.keys(overrides).length)cache.set(file,exports);return exports;}
const m=load('lib/insights/model.ts'),routing=load('i18n/public-routing.ts');
function form(){const f=new FormData();for(const [k,v] of Object.entries({id:'00000000-0000-4000-8000-000000000001',article_id:'00000000-0000-4000-8000-000000000002',revision:'0',locale:'nl',slug:'vastgoed-spanje',title:'Synthetic article',summary:'Summary',body:'## Heading\n\nText',author:'Tester',category:'real-estate',format:'guide',status:'draft',content_updated_on:'2026-10-31',publish_at:'2026-11-01T09:00:00.000Z'}))f.set(k,v);return f;}
test('insights input validates publication, bounds, languages, dates and source URLs',()=>{
 assert.equal(m.insightInput(form()).data.locale,'nl');
 for(const [k,v] of [['locale','xx'],['slug','../admin'],['slug','x/y'],['revision','1.5'],['content_updated_on','2026-02-30'],['publish_at','2026-11-01T09:00'],['sources','javascript:alert(1)'],['sources','https://site.test/private?token=secret'],['sources','https://user:secret@site.test/a'],['body','x'.repeat(60001)]]){const f=form();f.set(k,v);assert.throws(()=>m.insightInput(f));}
 const f=form();f.set('status','published');f.set('author','');assert.throws(()=>m.insightInput(f));f.set('status','draft');assert.equal(m.insightInput(f).data.author,'');
 for(const slug of ['الاستثمار-العقاري','房地产','ingatlan-magyarország','nákup-bytu'])assert.equal(m.validInsightSlug(slug),true);
});
test('public routes and analytics allow only the exact insights namespace',()=>{
 const analytics=load('lib/analytics/public.ts');
 for(const l of routing.locales){const p=m.insightPath(l,'example');assert.equal(routing.publicRoute(p).locale,l);assert.equal(analytics.analyticsPage(p).locale,l);assert.equal(routing.localizedPath('/insights',l),m.insightPath(l));}
 for(const p of ['/admin/insights','/nl/admin/insights','/insights/foo/bar','/insights/..','/insights/%2Fadmin','/insights/%ZZ'])assert.equal(routing.publicRoute(p),null);
 assert.equal(m.INSIGHTS_DISCOVERABLE,true);
});
test('publication time has an exact boundary and draft/archive override dates',()=>{
 const now=Date.parse('2026-11-01T10:00:00Z');assert.equal(m.publicationState({status:'published',publish_at:new Date(now).toISOString()},now),'published');assert.equal(m.publicationState({status:'published',publish_at:new Date(now+1).toISOString()},now),'scheduled');assert.equal(m.publicationState({status:'draft',publish_at:'2020-01-01'},now),'draft');assert.equal(m.publicationState({status:'archived',publish_at:'2020-01-01'},now),'archived');
});
test('all supported languages have complete public UI copy',()=>{const {insightsCopy}=load('lib/insights/copy.ts');for(const l of routing.locales){const c=insightsCopy(l);assert.equal(Object.keys(c).length,12);assert.ok(Object.values(c).every(v=>typeof v==='string'&&v.length>0));}});
test('rendered article text escapes scripts and keeps supported structure',()=>{
 const React=require('react'),{renderToStaticMarkup}=require('react-dom/server');const Content=load('app/insights/Content.tsx',{'../../lib/insights/model':m}).default;
 const html=renderToStaticMarkup(React.createElement(Content,{body:'## Heading\n\n<script>alert(1)</script>\n\n- One\n- Two\n\n### Detail'}));assert.match(html,/<h2>Heading<\/h2>/);assert.match(html,/<li>Two<\/li>/);assert.match(html,/&lt;script&gt;/);assert.doesNotMatch(html,/<script>/);
});
test('database publication and permission boundaries',{timeout:120000},()=>{assert.match(execFileSync(process.execPath,['tests/db/insights.cjs'],{encoding:'utf8',timeout:110000}),/checks passed/);});
test('save action authenticates before mutation and reports stale writes',async()=>{
 let allowed=false,calls=0,stale=false;const chain={eq(){return this},select(){return this},maybeSingle:async()=>({data:stale?null:{id:'id',revision:2},error:null}),single:async()=>({data:{id:'id',revision:1},error:null})};
 const actions=load('app/admin/insights/actions.ts',{'next/cache':{revalidatePath(){}},'../../../lib/security/estate-properties':{requireEstateAdmin:async()=>{if(!allowed)throw Error('denied');return {db:{from:()=>({insert(){calls++;return chain},update(){calls++;return chain}})}}}},'../../../lib/insights/model':m});
 await assert.rejects(actions.saveInsight({},form()),/denied/);assert.equal(calls,0);allowed=true;assert.equal((await actions.saveInsight({},form())).status,'success');const f=form();f.set('revision','1');stale=true;assert.match((await actions.saveInsight({},f)).message,/Someone changed/);
});
test('search discovery leaves existing public navigation untouched',()=>{
 for(const file of ['app/components/PublicHeader.tsx','app/components/HomeContactFooter.tsx','app/page.tsx'])assert.doesNotMatch(fs.readFileSync(file,'utf8'),/href=["']\/?insights|href:\s*["']\/insights/);
});
test('article metadata indexes published translations only in production',async()=>{
 const article={article_id:'group',title:'Synthetic',summary:'Summary',seo_title:'Custom title',seo_description:'Custom summary',locale:'nl',slug:'nederlands',author:'Tester',publish_at:'2026-10-30T10:00:00Z',content_updated_on:'2026-10-31'};
 for(const environment of ['production','preview']){
 const meta=load('app/insights/[slug]/page.tsx',{'next/link':()=>null,'next/navigation':{notFound(){throw Error('404')}},'next-intl/server':{getLocale:async()=>'nl'},'../../../i18n/public-routing':routing,'../../components/PublicHeader':{},'../../components/HomeContactFooter':{},'../../private-capital/IntroCallForm':{},'../../../lib/insights/data':{getInsight:async()=>article,translations:async()=>[{locale:'nl',slug:'nederlands'},{locale:'en',slug:'english'}]},'../../../lib/insights/model':m,'../../../lib/insights/copy':{},'../Content':{},'../Cards':{},'../insights.module.css':{}},environment);
 const result=await meta.generateMetadata({params:Promise.resolve({slug:'nederlands'})});assert.equal(result.title,'Custom title');assert.equal(result.robots.index,environment==='production');assert.equal(result.robots.follow,environment==='production');assert.equal(result.alternates.canonical,'/nl/insights/nederlands');assert.equal(result.alternates.languages.en,'/insights/english');assert.equal(Object.keys(result.alternates.languages).length,2);
 }
});
test('production sitemap exposes overview languages and only available article alternatives',async()=>{
 const articles=[{article_id:'one',locale:'nl',slug:'nederlands',content_updated_on:'2026-10-31'},{article_id:'one',locale:'en',slug:'english',content_updated_on:'2026-10-30'},{article_id:'two',locale:'de',slug:'anderer-artikel',content_updated_on:'2026-10-29'}];
 for(const environment of ['production','preview']){
  let reads=0;
  const sitemap=load('app/sitemap.ts',{'../i18n/public-routing':routing,'../lib/insights/model':m,'../lib/insights/data':{sitemapInsights:async()=>{reads++;return articles;}}},environment).default;
  const entries=await sitemap();assert.equal(entries.length,environment==='production'?147:0);assert.equal(reads,environment==='production'?1:0);
  if(environment==='preview')continue;
  for(const locale of routing.locales)assert.ok(entries.some(e=>e.url==='https://www.mzsgroup.com'+m.insightPath(locale)));
  const dutch=entries.find(e=>e.url.endsWith('/nl/insights/nederlands'));assert.equal(dutch.lastModified,'2026-10-31');assert.deepEqual(Object.keys(dutch.alternates.languages).sort(),['en','nl']);
  assert.equal(dutch.alternates.languages.en,'https://www.mzsgroup.com/insights/english');
  const overview=entries.find(e=>e.url==='https://www.mzsgroup.com/insights');assert.equal(Object.keys(overview.alternates.languages).length,25);
 }
 const empty=load('app/sitemap.ts',{'../i18n/public-routing':routing,'../lib/insights/model':m,'../lib/insights/data':{sitemapInsights:async()=>[]}}).default;
 assert.equal((await empty()).length,144);
});
test('overview metadata indexes clean production URLs, excluding filtered URLs and previews',async()=>{
 for(const environment of ['production','preview']){
  const meta=load('app/insights/page.tsx',{'next/link':()=>null,'next-intl/server':{getLocale:async()=>'nl'},'../../i18n/public-routing':routing,'../components/PublicHeader':{},'../components/HomeContactFooter':{},'../../lib/insights/model':m,'../../lib/insights/data':{},'../../lib/insights/copy':{insightsCopy:()=>({intro:'Introduction'})},'./Cards':{},'./insights.module.css':{}},environment);
  for(const query of [{},{category:'real-estate'},{page:'2'}]){
   const result=await meta.generateMetadata({searchParams:Promise.resolve(query)});
   assert.equal(result.robots.index,environment==='production'&&!Object.keys(query).length);
   assert.equal(result.robots.follow,environment==='production');assert.equal(result.alternates.canonical,'/nl/insights');
   assert.equal(result.alternates.languages.en,'/insights');assert.equal(result.alternates.languages.ar,'/ar/insights');
  }
 }
});
