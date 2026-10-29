import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),React=require('react'),{renderToStaticMarkup}=require('react-dom/server');
function compile(file,mocks={}){const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText,{exports,process,require:n=>n in mocks?mocks[n]:require(n)});return exports;}
const model=compile('lib/accountancy/pdf/model.ts',{'../administration':{dateValue:v=>v}});
test('production exposes assisted workspace but never enables PDF ingestion; crossed databases are denied',()=>{
 for(const [environment,url,workspace,intake] of [['production','ptrnjzmcehrhbsfxntgw',true,false],['preview','senonkpxdtlhyhrubicg',true,true],['production','senonkpxdtlhyhrubicg',false,false],['preview','ptrnjzmcehrhbsfxntgw',false,false]]){const env={VERCEL_ENV:environment,NEXT_PUBLIC_SUPABASE_URL:'https://'+url+'.supabase.co'};assert.equal(model.purchaseWorkspaceEnvironment(env),workspace);assert.equal(model.pdfIntakeEnvironment(env),intake);}
});
const year='77777777-7777-4777-8777-777777777777';
for(const language of ['en','es'])test('production assisted page '+language+' uses only existing records and links selected year to manual review',async()=>{
 let authenticated=false;const reads=[];const db={from(table){assert.equal(authenticated,true);reads.push(table);assert.ok(['mzs_accountancy_years','mzs_lease_issuers'].includes(table),'No staging table in production');const query={select(){return query;},order(){return query;},range(){return Promise.resolve({data:table==='mzs_accountancy_years'?[{id:year,issuer_id:'issuer',fiscal_year:2026}]:[{id:'issuer',name:'Synthetic entity'}],error:null,count:1});}};return query;}};
 const mocks={'next/link':{default:'a'},'next/navigation':{notFound(){throw Error('not found');}},'../../../../../lib/security/estate-properties':{requireEstateAdmin:async()=>{authenticated=true;return {db};}},'../../../../../lib/accountancy/pdf/server':{pdfProcessingReady:()=>false},'../../../../../lib/accountancy/pdf/model':{...model,purchaseWorkspaceEnvironment:()=>true,pdfIntakeEnvironment:()=>false},'../../../../../lib/accountancy/administration':{uuid:/^[0-9a-f-]{36}$/,ADMINISTRATION_ROOT:'/admin/workspaces/accountancy/administrations'},'../../../../../lib/property-operations/staff-data':{allRows:async fn=>(await fn(0,499)).data},'../../../../../lib/admin/i18n-server':{getAdminI18n:async()=>({language})},'./Forms':{UploadPdf(){throw Error('Production upload must not render');}},'../administrations/administration.module.css':{default:{}}};
 const page=compile('app/admin/workspaces/accountancy/purchases/page.tsx',mocks).default;const html=renderToStaticMarkup(await page({searchParams:Promise.resolve({year})}));assert.ok(html.includes(year+'#create-cost'));assert.ok(html.includes(year+'#costs'));assert.ok(html.includes('ChatGPT'));assert.ok(!html.includes('type="file"'));assert.equal(reads.length,2);
 mocks['../../../../../lib/security/estate-properties']={requireEstateAdmin:async()=>{throw Error('Denied');}};await assert.rejects(compile('app/admin/workspaces/accountancy/purchases/page.tsx',mocks).default({searchParams:Promise.resolve({year})}),/Denied/);
});
