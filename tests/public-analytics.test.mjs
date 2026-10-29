import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import vm from 'node:vm';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
function load(path,context={}) {const exports={};vm.runInNewContext(ts.transpileModule(read(path),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{exports,...context});return exports;}
const routing=load('i18n/public-routing.ts');
function fixture(host='www.mzsgroup.com') {
 let saved=null;const scripts=[];const w={location:{hostname:host,pathname:'/nl/about',href:`https://${host}/nl/about?email=private@example.com#token`}};
 const document={documentElement:{lang:'nl'},cookie:'',head:{appendChild:x=>scripts.push(x)},createElement:()=>({})};
 const localStorage={getItem:()=>saved,setItem:(_,v)=>saved=v};
 const shared={window:w,document,localStorage,URL,Date};
 const pub=load('lib/analytics/public.ts',{...shared,require:()=>routing});
 const google=load('lib/analytics/google.ts',{...shared,require:()=>pub});
 return {pub,google,w,document,scripts,setSaved:v=>saved=v,events:()=>Array.from(w.dataLayer||[],a=>Array.from(a)).filter(a=>a[0]==='event')};
}
test('all 80 marketing routes and request-access allowed, private/auth routes blocked',()=>{
 const {pub}=fixture();for(const locale of routing.locales)for(const path of routing.publicPaths)assert.ok(pub.analyticsPage(routing.localizedPath(path,locale)));
 for(const p of ['/login','/nl/login','/admin','/private','/private-capitality','/forgot-password','/auth/confirm','/api/intro-calls','/en/about'])assert.equal(pub.analyticsPage(p),null,p);
 assert.ok(pub.analyticsPage('/request-access'));assert.equal(pub.cleanLocation('https://www.mzsgroup.com/nl?email=secret#code'),'https://www.mzsgroup.com/nl');assert.equal(pub.cleanLocation('https://example.com/nl'),null);
});
test('no Google script without consent; denial, preview and private routes fail closed',()=>{
 const f=fixture();f.google.sendPage();f.google.setGoogleConsent(false);assert.equal(f.scripts.length,0);
 const preview=fixture('mzs-group-example.vercel.app');preview.google.setGoogleConsent(true);assert.equal(preview.scripts.length,0);
 f.w.location.pathname='/private';f.google.setGoogleConsent(true);assert.equal(f.scripts.length,0);
});
test('one script, deduplicated pages and only successful explicit lead signals with sanitized URLs',()=>{
 const f=fixture();f.google.setGoogleConsent(true);f.google.sendPage();assert.equal(f.scripts.length,1);assert.equal(f.events().length,1);
 assert.equal(f.scripts[0].src,'https://www.googletagmanager.com/gtag/js?id=G-JY9NR8LHLE');
 f.google.trackLead('intro_call');assert.equal(f.events()[1][1],'generate_lead');assert.equal(f.events()[1][2].lead_type,'intro_call');assert.ok(!JSON.stringify(f.events()).includes('private@example'));
 f.w.location.pathname='/nl/consultancy';f.w.location.href='https://www.mzsgroup.com/nl/consultancy';f.google.sendPage();assert.equal(f.events().length,3);
 f.w.location.pathname='/private';f.google.sendPage();f.google.trackLead('intro_call');assert.equal(f.events().length,3);assert.equal(f.w['ga-disable-G-JY9NR8LHLE'],true);
});
test('withdrawal disables collection and expired or malformed consent is rejected',()=>{
 const f=fixture();f.google.setGoogleConsent(true);f.google.setGoogleConsent(false);f.google.trackLead('account_request');assert.equal(f.events().length,1);assert.equal(f.w['ga-disable-G-JY9NR8LHLE'],true);
 for(const v of ['bad',JSON.stringify({choice:'granted',at:Date.now()-181*86400000}),JSON.stringify({choice:'granted',at:Date.now()+100000})]){f.setSaved(v);assert.equal(f.pub.readConsent(),null);}
 f.pub.saveConsent('granted');assert.equal(f.pub.readConsent(),'granted');
});
test('all consent languages present; form events occur only after confirmed API success',()=>{
 const {analyticsCopy}=load('lib/analytics/copy.ts');for(const l of routing.locales){assert.equal(analyticsCopy[l].length,6);assert.ok(analyticsCopy[l].every(Boolean));}
 const {analyticsCompactCopy}=load('lib/analytics/compact-copy.ts');for(const l of routing.locales){assert.equal(analyticsCompactCopy[l].length,4);assert.ok(analyticsCompactCopy[l].every(Boolean));}
 const intro=read('app/private-capital/IntroCallForm.tsx');assert.ok(intro.indexOf('trackLead("intro_call")')>intro.indexOf('result.recorded !== true'));
 const account=read('app/request-access/page.tsx');assert.ok(account.indexOf('trackLead("account_request")')>account.indexOf('!response.ok || !result.ok'));
});
