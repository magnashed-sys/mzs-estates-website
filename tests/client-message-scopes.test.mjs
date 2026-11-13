import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {createRequire} from 'node:module';
import ts from 'typescript';
const require=createRequire(import.meta.url), React=require('react');
const {renderToStaticMarkup}=require('react-dom/server');
const intl=require('next-intl');
const messages=JSON.parse(readFileSync('messages/nl.json','utf8'));
function load(file,modules={}){
 const exports={};const js=ts.transpileModule(readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022}}).outputText;
 new Function('require','exports',js)(id=>Object.hasOwn(modules,id)?modules[id]:require(id),exports);return exports;
}
const Scoped=load('app/components/ScopedClientMessages.tsx').default;
function Probe({namespace,keyName}){return React.createElement('span',null,intl.useTranslations(namespace)(keyName));}
const probe=(namespace,keyName)=>React.createElement(Probe,{namespace,keyName});
async function root(children,all=messages){
 const no=()=>null;
 const modules={'next-intl':{...intl,NextIntlClientProvider:props=>React.createElement(intl.NextIntlClientProvider,{timeZone:'Europe/Madrid',...props})},'next-intl/server':{getLocale:async()=>'nl',getMessages:async()=>all},'./globals.css':{},'./rtl.css':{},'../i18n/public-routing':{localeDirection:()=> 'ltr'}};
 for(const name of ['AnalyticsConsent','VisitorActivity','PublicWebAnalytics','PublicSpeedInsights'])modules['./components/'+name]={default:no};
 return load('app/layout.tsx',modules).default({children});
}
test('marketing shell retains navigation and forms while excluding account catalogues in all 24 languages',async()=>{
 for(const file of readdirSync('messages').filter(f=>f.endsWith('.json'))){
  const all=JSON.parse(readFileSync('messages/'+file));const tree=await root(null,all);
  const provider=tree.props.children.props.children[0];const shipped=provider.props.messages;
  for(const namespace of ['AccountUI','Login','CapitalUI','MemberUI','RentalAccount'])assert.equal(shipped[namespace],undefined);
  assert.deepEqual(Object.keys(shipped.Private).sort(),['signing_out','signout','signout_error']);
  for(const namespace of ['Header','Call','ContactInput','Language'])assert.deepEqual(shipped[namespace],all[namespace]);
  const previous=Object.fromEntries(['ContactInput','RentalAccount','Header','Footer','Call','Language','Login','Private','CapitalUI','MemberUI','AccountUI'].map(k=>[k,all[k]]));
  assert.ok(JSON.stringify(shipped).length<JSON.stringify(previous).length*.4,file+' should remove at least 60% of client copy');
 }
 assert.match(renderToStaticMarkup(await root(probe('Private','signout'))),/Uitloggen/);
});
test('nested providers preserve shared copy and replace partial namespaces',()=>{
 const html=renderToStaticMarkup(React.createElement(intl.NextIntlClientProvider,{locale:'nl',timeZone:'Europe/Madrid',messages:{Header:messages.Header,Private:{signout:messages.Private.signout}}},React.createElement(Scoped,{messages:{Private:messages.Private,Login:messages.Login}},React.createElement(React.Fragment,null,probe('Header','login'),probe('Private','signout'),probe('Login',Object.keys(messages.Login)[0])))));
 assert.ok(html.includes(messages.Header.login));assert.ok(html.includes(messages.Private.signout));assert.ok(!html.includes('MISSING_MESSAGE'));
});
test('login and private layouts supply their translations on direct entry and nested navigation',async()=>{
 for(const [file,namespaces] of [['app/login/layout.tsx',['Login']],['app/private/layout.tsx',['Private','RentalAccount','MemberUI','CapitalUI']]]){
  const Layout=load(file,{'next-intl/server':{getMessages:async()=>messages},'../components/ScopedClientMessages':{default:Scoped}}).default;
  const child=await Layout({children:probe('Header','login')});
  assert.deepEqual(Object.keys(child.props.messages).sort(),namespaces.sort());
  const html=renderToStaticMarkup(await root(child));assert.ok(html.includes(messages.Header.login));
 }
});
test('all client account routes receive AccountUI and localized login reuses its scoped layout',()=>{
 const scoped=readFileSync('app/components/AccountMessages.tsx','utf8');assert.match(scoped,/messages=\{\{AccountUI\}\}/);
 for(const route of ['forgot-password','request-access'])assert.match(readFileSync('app/'+route+'/layout.tsx','utf8'),/<AccountMessages>/);
 for(const route of ['reset-password','accept-invitation'])assert.match(readFileSync('app/'+route+'/layout.tsx','utf8'),/forgot-password\/layout/);
 assert.match(readFileSync('app/[locale]/login/layout.tsx','utf8'),/login\/layout/);
});

test('contact controls keep identical initial HTML across differing Intl country names',()=>{
 const actualHook=load('app/components/useBrowserHydrated.ts');
 const copy={ContactInput:messages.ContactInput};
 for(const component of ['CountrySelect','PhoneInput']){
  function render(browserNames,hydrated=false){
   const Component=load('app/components/'+component+'.tsx',{
    './contact-inputs.module.css':{default:{}},
    './useBrowserHydrated':hydrated?{useBrowserHydrated:()=>true}:actualHook,
    '../../lib/contact-inputs':{
     countryOptions:(_locale,_telephone,localized)=>[{code:'HK',name:localized?(browserNames?'Hongkong':'Hongkong SAR van China'):'HK'}],
     countryCode:()=>browserNames?undefined:'HK',countryName:()=> 'Hong Kong',
     splitPhone:value=>({value,country:'',national:value,error:''}),callingCode:()=> '852',
    },
   }).default;
   return renderToStaticMarkup(React.createElement(intl.NextIntlClientProvider,{locale:'nl',timeZone:'Europe/Madrid',messages:copy},React.createElement(Component,{value:component==='CountrySelect'?'Hongkong SAR van China':'',onChange(){},label:'Telephone'})));
  }
  assert.equal(render(false),render(true),component+' must hydrate with matching HTML');
  assert.ok(render(true,true).includes('Hongkong'));
 }
});
