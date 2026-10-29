import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {createRequire} from 'node:module';
import vm from 'node:vm';
import ts from 'typescript';
import {adminI18n,adminI18nFixture,createAdminTranslator} from './helpers/admin-i18n.mjs';
const require=createRequire(import.meta.url);
const compile=p=>ts.transpileModule(readFileSync(p,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
const catalogue=JSON.parse(readFileSync('lib/admin/translations.es.json','utf8'));
const english=JSON.parse(readFileSync('lib/admin/translations.en.json','utf8'));
const files=d=>readdirSync(d,{withFileTypes:true}).flatMap(e=>e.isDirectory()?files(d+'/'+e.name):[d+'/'+e.name]);
test('every explicitly translated admin message exists in Spanish and keeps all interpolation variables',()=>{
 const missing=[];
 for(const file of [...files('app/admin'),...['WorkRegisters','WorkForms','PhotoPanel'].map(x=>'app/staff/'+x+'.tsx')].filter(x=>x.endsWith('.tsx'))){
  const sf=ts.createSourceFile(file,readFileSync(file,'utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
  const visit=n=>{if(ts.isCallExpression(n)&&['adminT','t'].includes(n.expression.getText(sf))&&(ts.isStringLiteral(n.arguments[0])||ts.isNoSubstitutionTemplateLiteral(n.arguments[0]))){const key=n.arguments[0].text.replace(/\s+/g,' ').trim();if(!Object.hasOwn(catalogue,key))missing.push({file,key});}ts.forEachChild(n,visit);};visit(sf);
 }
 assert.deepEqual(missing,[]);
 for(const [key,value] of Object.entries(catalogue)){assert.ok(value.trim(),key);const vars=s=>[...new Set(s.match(/\{p\d+\}/g)??[])].sort();assert.deepEqual(vars(value),vars(key),key);}
 for(const [key,value] of Object.entries(english))assert.equal(adminI18n('en').t(key),value);
});
test('locale selection is isolated, has a safe English fallback and preserves literal data in messages',async()=>{
 const en=createAdminTranslator('en'),es=createAdminTranslator('es');
 assert.equal(en('Bookings'),'Bookings');assert.equal(es('Bookings'),'Reservas');assert.equal(adminI18n('nl').locale,'en-GB');assert.equal(adminI18n('es').locale,'es-ES');
 const key='Review access for {p0}',name='<img src=x onerror=alert(1)> $& {p1}';
 assert.equal(es(key,{p0:name}),catalogue[key].replace('{p0}',()=>name));
 assert.equal(en(' A private\n Spanish note '),' A private\n Spanish note ');assert.equal(es('Cliente inventado: notas personales'),'Cliente inventado: notas personales');
 const text=' x'.repeat(5000);assert.equal(es(text),text);
 const result=await Promise.all(['es','en','es','en'].map(async l=>adminI18n(l).t('Bookings')));assert.deepEqual(result,['Reservas','Bookings','Reservas','Bookings']);
 assert.equal(new Intl.NumberFormat(adminI18n('es').locale,{style:'currency',currency:'EUR'}).format(1234.5),'1234,50 €');
});
test('all eight primary admin sections render in Spanish with original destinations and active route',()=>{
 const exports={};vm.runInNewContext(compile('app/admin/workspaces/WorkspaceNavigation.tsx'),{exports,require:n=>n.includes('/admin/i18n')?adminI18nFixture('es'):n==='next/navigation'?{usePathname:()=>'/admin/workspaces/accountancy/documents',useSearchParams:()=>new URLSearchParams()}:n==='next/link'?{default:'a'}:n.endsWith('.css')?{default:{}}:require(n)});
 const html=require('react-dom/server').renderToStaticMarkup(require('react').createElement(exports.default));
 const labels=[...html.matchAll(/<a\b[^>]*>([^<]+)<\/a>/g)].map(m=>m[1]);assert.deepEqual(labels,['Panel de control','Reservas','Inmobiliario','Capital','Relaciones','Personal','Contabilidad','Sistema']);assert.match(html,/aria-current="page"[^>]*>Contabilidad/);assert.match(html,/href="\/admin\/bookings"/);
});
function languageAction({user={id:'own-account'},active=true,authError=null,profileError=null,saveError=null,isolated=true}={}){
 const calls=[],exports={};const db={auth:{getUser:async()=>{calls.push('auth');return {data:{user},error:authError};}},from:table=>{calls.push(table);return {select:()=>({eq:(field,value)=>({maybeSingle:async()=>{calls.push([field,value]);return {data:{is_active:active},error:profileError};}})}),upsert:async row=>{calls.push(row);return {error:saveError};}}}};
 vm.runInNewContext(compile('app/admin/language-actions.ts'),{exports,require:n=>n==='next/cache'?{revalidatePath:(...a)=>calls.push(a)}:n.includes('/supabase/server')?{createClient:async()=>db}:n.includes('phase3a')?{isPhase3aPreviewIsolated:()=>isolated}:(()=>{throw Error(n)})()});return {calls,save:exports.saveAdminLanguage};
}
test('language action writes only the authenticated account and refreshes the entire admin',async()=>{
 const x=languageAction();assert.equal((await x.save('es')).ok,true);assert.deepEqual(JSON.parse(JSON.stringify(x.calls)),['auth','profiles',['id','own-account'],'mzs_admin_language_preferences',{user_id:'own-account',language:'es'},['/admin','layout']]);
 for(const options of [{user:null},{active:false},{authError:{}},{profileError:{}},{saveError:{}},{isolated:false}]){const y=languageAction(options);assert.equal((await y.save('es')).ok,false);assert.ok(!y.calls.some(c=>Array.isArray(c)&&c[0]==='/admin'));}
 for(const value of ['nl','ES','es; DROP TABLE profiles',null,{},'']){const x=languageAction();assert.equal((await x.save(value)).ok,false);assert.equal(x.calls.length,0);}
});
test('preference lookup defaults to English on missing authentication, missing preference or database failure',async()=>{
 for(const [user,language,error,expected] of [[null,'es',null,'en'],[{id:'one'},'es',null,'es'],[{id:'one'},'xx',null,'en'],[{id:'one'},'es',{},'en']]){
  const exports={},calls=[];vm.runInNewContext(compile('lib/admin/language.ts'),{exports,require:n=>n==='react'?{cache:f=>f}:n.includes('phase3a')?{isPhase3aPreviewIsolated:()=>true}:{createClient:async()=>({auth:{getUser:async()=>({data:{user}})},from:()=>({select:()=>({eq:(key,id)=>({maybeSingle:async()=>{calls.push([key,id]);return {data:{language},error}}})})})})}});
  assert.equal(await exports.getAdminLanguage(),expected);assert.deepEqual(calls,user?[['user_id','one']]:[]);
 }
});
test('personal language RLS allows scoped users without allowing cross-account writes or access to documents',async()=>{
 const {PGlite}=require('@electric-sql/pglite'),db=new PGlite();
 try{
 await db.exec(`create role authenticated;create role anon;create schema auth;create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to authenticated;
 create table mzs_admin_language_preferences(user_id uuid primary key,language text not null check(language in ('en','es')));alter table mzs_admin_language_preferences enable row level security;grant select,insert,update on mzs_admin_language_preferences to authenticated;
 create policy admin_language_read on mzs_admin_language_preferences for select to authenticated using(false);
 create policy admin_language_insert on mzs_admin_language_preferences for insert to authenticated with check(false);
 create policy admin_language_update on mzs_admin_language_preferences for update to authenticated using(false) with check(false);
 create table private_documents(id integer);insert into private_documents values(1);alter table private_documents enable row level security;grant select on private_documents to authenticated;`);
 await db.exec(readFileSync('supabase/migrations/20261029104402_admin_language_personal_preference.sql','utf8'));
 const one='00000000-0000-4000-8000-000000000001',two='00000000-0000-4000-8000-000000000002';
 await db.exec(`set role authenticated;select set_config('request.jwt.claim.sub','${one}',false);`);
 await db.query('insert into mzs_admin_language_preferences values($1,$2)',[one,'es']);
 await assert.rejects(db.query('insert into mzs_admin_language_preferences values($1,$2)',[two,'es']),/row-level security/);
 await assert.rejects(db.query('update mzs_admin_language_preferences set user_id=$1',[two]),/row-level security/);
 await assert.rejects(db.query("update mzs_admin_language_preferences set language='nl'"),/check constraint/);
 assert.equal((await db.query('select * from private_documents')).rows.length,0);
 await db.exec(`select set_config('request.jwt.claim.sub','${two}',false)`);
 assert.equal((await db.query('select * from mzs_admin_language_preferences')).rows.length,0);
 assert.equal((await db.query("update mzs_admin_language_preferences set language='en' returning user_id")).rows.length,0);
 await db.query('insert into mzs_admin_language_preferences values($1,$2)',[two,'en']);
 await db.query('insert into mzs_admin_language_preferences values($1,$2) on conflict(user_id) do update set language=excluded.language',[two,'es']);
 assert.equal((await db.query('select language from mzs_admin_language_preferences')).rows[0].language,'es');
 await db.exec('reset role;set role anon');await assert.rejects(db.query('select * from mzs_admin_language_preferences'),/permission denied/);
 }finally{await db.close();}
});
