import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import vm from 'node:vm';
import ts from 'typescript';
import {adminI18nFixture} from './helpers/admin-i18n.mjs';
const require=createRequire(import.meta.url),React=require('react'),{renderToStaticMarkup}=require('react-dom/server');
function compile(file,mocks){const exports={};vm.runInNewContext(ts.transpileModule(readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText,{exports,require:n=>n in mocks?mocks[n]:n.endsWith('.css')?{default:{}}:require(n)});return exports;}
function server({isolated=true,user={id:'admin'},profile={role:'admin',is_active:true},scope=false,error=null}={}){
 let calls=0;
 const Header=compile('app/admin/AdminHeader.tsx',{
  '../../lib/security/phase3a-preview-isolation':{isPhase3aPreviewIsolated:()=>isolated},
  '../../lib/supabase/server':{createClient:async()=>{calls++;return {auth:{getUser:async()=>({data:{user},error:null})},from:()=>({select:()=>({eq:()=>({single:async()=>({data:profile,error})})})}),rpc:async()=>({data:scope,error:null})};}},
  './AdminHeaderControls':{default:'test-header'},
 }).default;
 return {Header,calls:()=>calls};
}
test('header hides module navigation for unverified/inactive/unauthorised visitors and fails closed in unsafe previews',async()=>{
 const isolated=server({isolated:false});assert.equal(await isolated.Header(),null);assert.equal(isolated.calls(),0);
 for(const options of [{user:null},{profile:null},{profile:{role:'admin',is_active:false}},{profile:{role:'client',is_active:true}},{error:{message:'unavailable'}}])assert.equal(await server(options).Header(),null);
});
test('group and scoped Capital accounts receive only their intended navigation mode',async()=>{
 assert.equal((await server().Header()).props.groupAdmin,true);
 assert.equal((await server({profile:{role:'client',is_active:true},scope:true}).Header()).props.groupAdmin,false);
});
test('shared header keeps one language picker and appropriate module navigation in both admin languages',()=>{
 for(const language of ['en','es']){
  const Header=compile('app/admin/AdminHeaderControls.tsx',{
   '../../lib/admin/i18n':adminI18nFixture(language),'next/link':{default:'a'},
   '../../lib/supabase/client':{createClient:()=>{throw Error('render must not sign out');}},
   './AdminNavigationGuard':{useAdminNavigation:()=>({canNavigate:()=>true})},
   './AdminDirectory':{default:()=>React.createElement('details',null,'directory')},
   './AdminLanguageSwitcher':{default:()=>React.createElement('select',{'aria-label':'language'})},
   './workspaces/WorkspaceNavigation':{default:()=>React.createElement('nav',null,'workspaces')},
  }).default;
  for(const groupAdmin of [true,false]){
   const html=renderToStaticMarkup(React.createElement(Header,{groupAdmin}));
   assert.equal((html.match(/<header/g)||[]).length,1);assert.equal((html.match(/<select/g)||[]).length,1);
   assert.equal(html.includes('href="/admin/accounts"'),groupAdmin);
   assert.equal(html.includes('<details>'),groupAdmin);
   assert.equal(html.includes('href="/admin/group/capital"'),!groupAdmin);
   assert.match(html,/target="_blank" rel="noopener noreferrer"/);
   assert.ok(html.includes(language==='es'?'Cerrar sesión':'Sign out'));
  }
 }
});
