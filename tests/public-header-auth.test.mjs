import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, readdirSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import * as jsx from 'react/jsx-runtime';
import {createTranslator} from 'next-intl';

const source=ts.transpileModule(readFileSync('app/components/PublicHeader.tsx','utf8'),{
 compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}
}).outputText;
function deferred(){let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return{promise,resolve,reject};}
function fixture({locale='nl',user={id:'synthetic-user'},profile={role:'client',is_active:true},profileResult,signOut=async()=>({error:null})}={}){
 const slots=[],effects=[],scheduled=[],redirects=[],calls=[];
 let index=0,first=true,authListener,cleanup,unsubscribed=false,profileCalls=0;
 const messages=JSON.parse(readFileSync(`messages/${locale}.json`,'utf8'));
 const react={
  useState(initial){const i=index++;if(!(i in slots))slots[i]=initial;return[slots[i],value=>{slots[i]=typeof value==='function'?value(slots[i]):value;}];},
  useRef(initial){const i=index++;if(!(i in slots))slots[i]={current:initial};return slots[i];},
  useEffect(effect){if(first)effects.push(effect);}
 };
 const client={auth:{
  getUser:async()=>({data:{user},error:null}),
  onAuthStateChange(fn){authListener=fn;return{data:{subscription:{unsubscribe(){unsubscribed=true;}}}};},
  async signOut(options){calls.push({...options});return signOut();}
 },from(table){assert.equal(table,'profiles');profileCalls++;return{select(){return this;},eq(key,value){assert.equal(key,'id');assert.equal(value,user.id);return this;},maybeSingle:()=>profileResult??Promise.resolve({data:profile,error:null})};}};
 const deps={react,'react/jsx-runtime':jsx,'next-intl':{useLocale:()=>locale,useTranslations:namespace=>createTranslator({locale,messages,namespace})},
  './ArrowUpRightIcon':{default:()=>null},'./LanguageSwitcher':{default:()=>null},
  '../../i18n/public-routing':{localizedPath:(path,l)=>l==='en'?path:`/${l}${path==='/'?'':path}`},
  '../../lib/supabase/client':{createClient:()=>client},'./PublicHeader.module.css':{default:new Proxy({},{get:(_,key)=>key})}
 };
 const exports={};vm.runInNewContext(source,{exports,require:name=>{assert.ok(name in deps,name);return deps[name];},window:{setTimeout:fn=>scheduled.push(fn),location:{replace:path=>redirects.push(path)}}});
 function render(){index=0;const tree=exports.default();if(first){first=false;for(const effect of effects)cleanup=effect();}return tree;}
 async function settle(){for(let i=0;i<12;i++){await Promise.resolve();while(scheduled.length)scheduled.shift()();}}
 function emit(event){authListener(event);}
 return{render,settle,emit,calls,redirects,messages,unmount:()=>cleanup(),get unsubscribed(){return unsubscribed;},get profileCalls(){return profileCalls;}};
}
function nodes(tree,predicate){if(!tree||typeof tree!=='object')return[];if(Array.isArray(tree))return tree.flatMap(n=>nodes(n,predicate));return[...(predicate(tree)?[tree]:[]),...nodes(tree.props?.children,predicate)];}
const buttons=tree=>nodes(tree,n=>n.type==='button');
const dashboards=tree=>nodes(tree,n=>n.type==='a'&&['/private','/admin'].includes(n.props.href));

test('anonymous header has Login and no account actions; inactive/unknown profiles get no dashboard',async()=>{
 for(const options of [{user:null},{profile:{role:'client',is_active:false}},{profile:{role:'unknown',is_active:true}},{profile:null}]){
  const f=fixture(options);assert.equal(buttons(f.render()).length,0);await f.settle();const tree=f.render();
  assert.equal(buttons(tree).length,0);assert.equal(dashboards(tree).length,0);
  assert.equal(nodes(tree,n=>n.type==='a'&&n.props.href==='/nl/login').length,2);
  if(options.user===null)assert.equal(f.profileCalls,0);
 }
});
test('every supported locale shows translated logout under the correct desktop/mobile dashboard',async()=>{
 for(const file of readdirSync('messages').filter(x=>x.endsWith('.json')))for(const role of ['admin','client','partner']){
  const f=fixture({locale:file.slice(0,-5),profile:{role,is_active:true}});f.render();await f.settle();const tree=f.render();
  const actions=buttons(tree);assert.equal(actions.length,2);assert.ok(actions.every(b=>b.props.children===f.messages.Private.signout&&b.props.type==='button'));
  assert.ok(dashboards(tree).every(a=>a.props.href===(role==='admin'?'/admin':'/private')));
  assert.equal(nodes(tree,n=>n.type==='a'&&/\/login$/.test(n.props.href)).length,0);
  const group=nodes(tree,n=>n.props?.className==='accountActions')[0];assert.equal(group.props.children[0].type,'a');assert.equal(group.props.children[1].type,'button');
 }
});
test('logout disables both buttons, submits once for this browser, and returns to the localized home',async()=>{
 const pending=deferred(),f=fixture({signOut:()=>pending.promise});f.render();await f.settle();
 const click=buttons(f.render())[0].props.onClick;const done=click();await click();
 assert.equal(f.calls.length,1);assert.equal(f.calls[0].scope,'local');assert.ok(buttons(f.render()).every(b=>b.props.disabled));assert.deepEqual(f.redirects,[]);
 pending.resolve({error:null});await done;
 assert.deepEqual(f.redirects,['/nl']);assert.equal(buttons(f.render()).length,0);
});
test('server logout errors and thrown failures stay signed in, announce the error and allow a retry',async()=>{
 for(const thrown of [false,true]){
  let attempts=0;const f=fixture({signOut:async()=>{if(attempts++===0){if(thrown)throw Error('offline');return{error:Error('unavailable')};}return{error:null};}});
  f.render();await f.settle();await buttons(f.render())[0].props.onClick();const tree=f.render();
  assert.deepEqual(f.redirects,[]);assert.equal(dashboards(tree).length,2);assert.ok(buttons(tree).every(b=>!b.props.disabled));
  assert.equal(nodes(tree,n=>n.props?.role==='alert')[0].props.children,f.messages.Private.signout_error);
  await buttons(tree)[1].props.onClick();assert.equal(f.calls.length,2);assert.deepEqual(f.redirects,['/nl']);
 }
});
test('a profile lookup that finishes after SIGNED_OUT cannot restore the dashboard or logout button',async()=>{
 const pending=deferred(),f=fixture({profileResult:pending.promise});f.render();await f.settle();assert.equal(f.profileCalls,1);
 f.emit('SIGNED_OUT');pending.resolve({data:{role:'admin',is_active:true},error:null});await f.settle();
 assert.equal(dashboards(f.render()).length,0);assert.equal(buttons(f.render()).length,0);
});
test('auth events update account actions and unmount unsubscribes from session changes',async()=>{
 const f=fixture();f.render();await f.settle();assert.equal(buttons(f.render()).length,2);
 f.emit('SIGNED_OUT');assert.equal(buttons(f.render()).length,0);
 f.emit('SIGNED_IN');await f.settle();assert.equal(buttons(f.render()).length,2);
 f.unmount();assert.equal(f.unsubscribed,true);
});
