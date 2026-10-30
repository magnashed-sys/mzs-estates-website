import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import {createTranslator} from 'next-intl';
import {renderToStaticMarkup} from 'react-dom/server';
import * as jsx from 'react/jsx-runtime';
const js=ts.transpileModule(readFileSync(new URL('../app/private/capital/page.tsx',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
function harness(locale,{active=true,authenticated=true,allowed=true,loadError=false}={}){
 const messages=JSON.parse(readFileSync(new URL(`../messages/${locale}.json`,import.meta.url)));const exports={};let reads=0;
 vm.runInNewContext(js,{exports,process:{env:{VERCEL_ENV:'production'}},require(name){
  if(name==='react/jsx-runtime')return jsx;
  if(name==='next-intl/server')return {getTranslations:async()=>createTranslator({locale,messages:messages.AccountUI})};
  if(name==='next/navigation')return {notFound:()=>{throw Error('404')},redirect:()=>{throw Error('login')}};
  if(name.endsWith('/capital-client-environment'))return {capitalClientEnvironmentAllowed:()=>allowed};
  if(name.endsWith('/server'))return {createClient:async()=>({auth:{getUser:async()=>({data:{user:authenticated?{id:'local-user'}:null}})},from:()=>({select(){return this},eq(){return this},single:async()=>({data:{is_active:active,role:'client'}})}),rpc:async()=>{reads++;return {data:[],error:loadError?{}:null}}})};
  if(name.endsWith('.css'))return {default:{}};
  if(name==='./SummaryCards')return {default:()=>null};
  throw Error(name);
 }});return {exports,messages,reads:()=>reads};
}
test('Capital page localizes surrounding copy and empty/error states in all twenty languages',async()=>{
 for(const locale of ['en','nl','es','ru','de','it','fr','pt-BR','ar','tr','lt','pl','zh-CN','sv','ro','nb','da','uk','fi','cs','hu','bg','sk','el'])for(const loadError of [false,true]){
  const h=harness(locale,{loadError});const html=renderToStaticMarkup(await h.exports.default());
  assert.ok(html.includes(h.messages.AccountUI.a101));assert.ok(html.includes(h.messages.AccountUI[loadError?'a105':'a106']));assert.equal(h.reads(),1);
 }
});
test('Capital page still denies invalid environments, signed-out and inactive users before loading dossiers',async()=>{
 for(const locale of ['en','nl','es','ru','de','it','fr','pt-BR','ar','tr','lt','pl','zh-CN','sv','ro','nb','da','uk','fi','cs','hu','bg','sk','el'])for(const [options,message] of [[{allowed:false},'404'],[{authenticated:false},'login'],[{active:false},'404']]){const h=harness(locale,options);await assert.rejects(h.exports.default(),new RegExp(message));assert.equal(h.reads(),0);}
});
