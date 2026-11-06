import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';import ts from 'typescript';import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
function load(path,deps={}){const exports={};const code=ts.transpileModule(fs.readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;vm.runInThisContext('(function(exports,require){'+code+'\n})')(exports,n=>n in deps?deps[n]:require(n));return exports;}
const billing=load('lib/property-operations/zorgbalans-billing.ts');
const visits=[{id:'a',profile_id:'worker-a',worked_on:'2026-11-01',effective_minutes:25,invoiced_hours:1,net_cents:2500,description:'Office cleaning'}, {id:'b',profile_id:'worker-b',worked_on:'2026-11-02',effective_minutes:73,invoiced_hours:2,net_cents:5000,description:'Internet guidance'}];
test('billing selection totals use approved minutes and already rounded rows, with no hidden or stale selections',()=>{
 const totals=billing.billingSelection(visits,['a','b','a','stale']);assert.equal(totals.count,2);assert.equal(totals.minutes,98);assert.equal(totals.hours,3);assert.equal(totals.net,7500);assert.equal(totals.vat,1575);assert.equal(totals.gross,9075);
 const filtered=billing.billingVisits(visits,'2026-11-02','2026-11-02','worker-b');const selected=billing.billingSelection(filtered,['a','b']);assert.equal(selected.count,1);assert.equal(selected.minutes,73);assert.equal(selected.gross,6050);
 assert.equal(billing.billingVisits(visits,'2026-11-03','2026-11-01','').length,0);assert.equal(billing.billingSelection(visits,[]).gross,0);
});
test('draft form requires an explicit selection, caps bulk selection at 100 and clears it on filter changes',()=>{
 const React=require('react');const state=[];let slot=0;
 const hooks={...React,useState(initial){const i=slot++;if(!(i in state))state[i]=initial;return [state[i],v=>state[i]=typeof v==='function'?v(state[i]):v];},useActionState:()=>[{status:'idle',message:''},()=>{},false]};
 const form=load('app/admin/workspaces/estates/zorgbalans/BillingControls.tsx',{react:hooks,'./actions':{},'../../../../../lib/property-operations/zorgbalans-billing':billing,'./zorgbalans.module.css':{default:new Proxy({},{get:(_,key)=>key})}}).DraftForm;
 const records=Array.from({length:101},(_,i)=>({...visits[i%2],id:String(i)}));
 const nodes=root=>{const all=[];function walk(n){if(!n||typeof n!=='object')return;if(Array.isArray(n)){n.forEach(walk);return}all.push(n);walk(n.props?.children);}walk(root);return all;};
 const render=()=>{slot=0;return nodes(form({visits:records,people:[{id:'worker-a',full_name:'Test A'},{id:'worker-b',full_name:'Test B'}],today:'2026-11-06',language:'en'}));};
 let tree=render();assert.equal(tree.find(n=>n.type==='button'&&n.props.type==='submit').props.disabled,true);assert.equal(tree.filter(n=>n.props?.type==='checkbox'&&n.props.checked).length,0);
 tree.find(n=>n.type==='button'&&n.props.children==='Select first 100 shown').props.onClick();tree=render();assert.equal(tree.filter(n=>n.props?.type==='checkbox'&&n.props.checked).length,100);assert.equal(tree.filter(n=>n.props?.type==='checkbox'&&n.props.disabled).length,1);assert.equal(tree.find(n=>n.type==='button'&&n.props.type==='submit').props.disabled,false);
 tree.find(n=>n.type==='input'&&n.props.type==='date'&&!n.props.name).props.onChange({target:{value:'2026-11-02'}});tree=render();assert.equal(tree.filter(n=>n.props?.type==='checkbox'&&n.props.checked).length,0);assert.equal(tree.find(n=>n.type==='button'&&n.props.type==='submit').props.disabled,true);
});
const id='11111111-1111-4111-8111-111111111111';
function actionFixture(language='en',error=null){const calls=[],invalidated=[];const actions=load('app/admin/workspaces/estates/zorgbalans/actions.ts',{'../../../../../lib/security/property-staff':{requireStaffEnvironment(){}},'../../../../../lib/security/estate-properties':{requireEstateAdmin:async()=>({db:{rpc:async(name,args)=>{calls.push({name,args});return {data:name.includes('prepare')?id:true,error};}}})},'../../../../../lib/admin/i18n-server':{getAdminI18n:async()=>({language})},'../../../../../lib/property-operations/zorgbalans-billing':billing,'../../../../../lib/property-operations/revalidate':{revalidateOperations:()=>invalidated.push('operations')},'next/cache':{revalidatePath:p=>invalidated.push(p)}});const form=new FormData();form.set('invoice_number','9999');form.set('issued_on','2026-11-06');form.set('visit_id',id);return {actions,form,calls,invalidated};}
test('draft action rejects invalid dates, duplicate visits and oversized batches before RPC',async()=>{
 for(const kind of ['date','duplicate','empty','oversized']){const f=actionFixture();if(kind==='date')f.form.set('issued_on','2026-02-30');if(kind==='duplicate')f.form.append('visit_id',id);if(kind==='empty')f.form.delete('visit_id');if(kind==='oversized'){f.form.delete('visit_id');for(let i=0;i<101;i++)f.form.append('visit_id','11111111-1111-4111-8111-'+String(i).padStart(12,'0'));}assert.equal((await f.actions.prepareZorgbalansInvoice({},f.form)).status,'error');assert.equal(f.calls.length,0);}
});
test('draft and delivery actions preserve separate confirmation and translate feedback',async()=>{
 for(const language of ['en','es']){const f=actionFixture(language);const result=await f.actions.prepareZorgbalansInvoice({},f.form);assert.equal(result.status,'success');assert.equal(f.calls.length,1);assert.equal(f.calls[0].name,'mzs_ops_prepare_zorgbalans_invoice');assert.match(result.message,language==='es'?/Borrador/:/draft/);assert.equal(f.invalidated.length,2);
 const sent=new FormData();sent.set('invoice_id',id);sent.set('confirmation_note','External test reference');assert.equal((await f.actions.confirmZorgbalansInvoice({},sent)).status,'success');assert.equal(f.calls[1].name,'mzs_ops_confirm_zorgbalans_invoice');}
 const failure=actionFixture('es',{});assert.equal((await failure.actions.prepareZorgbalansInvoice({},failure.form)).status,'error');assert.equal(failure.invalidated.length,0);
});
function pdfFixture({mismatch=false,status='concept',lines=2}={}){
 const description='W'.repeat(90)+' '+('Long synthetic description for wrapping verification. '.repeat(22))+'END OF FULL DESCRIPTION';
 const data=Array.from({length:lines},(_,i)=>({id:String(i),worked_on:'2026-11-01',actual_minutes:25,invoiced_hours:1,net_cents:2500,description:i===0?description:'Normal synthetic visit '+i}));
 const invoice={id,invoice_number:'9999',issued_on:'2026-11-06',due_on:'2026-11-20',period_from:'2026-11-01',period_until:'2026-11-01',customer_name:'Stichting Zorgbalans',customer_reference:'KOSTENPLAATS 652001 Prettig Thuis IJmuiden',hours:lines,net_cents:2500*lines,vat_cents:525*lines,gross_cents:3025*lines+(mismatch?1:0),status,issuer_id:id};
 const db={from(table){const q={select(){return q},eq(){return q},order(){return q},limit:async()=>({data,error:null}),maybeSingle:async()=>({data:table==='mzs_ops_zorgbalans_invoices'?invoice:{name:'Magdy Nashed',kind:'person',iban:'TEST IBAN - NOT FOR PAYMENT',tax_id:'TEST TAX ID'},error:null})};return q}};
 return load('app/api/admin/zorgbalans/invoices/[id]/pdf/route.ts',{'../../../../../../../lib/security/estate-properties':{requireEstateAdmin:async()=>({db})},'../../../../../../../lib/security/property-staff':{requireStaffEnvironment(){}}}).GET(new Request('https://example.invalid'),{params:Promise.resolve({id})});
}
test('PDF keeps complete long descriptions, supports 100 lines and withholds mismatched totals',async()=>{
 const {getDocument}=await import('pdfjs-dist/legacy/build/pdf.mjs');
 for(const lines of [2,100]){const response=await pdfFixture({lines});assert.equal(response.status,200);assert.match(response.headers.get('cache-control'),/private, no-store/);const bytes=new Uint8Array(await response.arrayBuffer());if(lines===2&&process.env.MZS_ZORG_PDF_PREVIEW)fs.writeFileSync(process.env.MZS_ZORG_PDF_PREVIEW,bytes);
 const loading=getDocument({data:bytes,useSystemFonts:true});const doc=await loading.promise;let text='';for(let i=1;i<=doc.numPages;i++){const page=await doc.getPage(i);const content=await page.getTextContent();text+=content.items.map(x=>x.str).join(' ');for(const item of content.items){assert.ok(item.transform[4]+item.width<=557,'text exceeds right margin');if(i>1&&item.transform[4]===113)assert.ok(item.width<=292,'description overlaps numeric columns');}}
 assert.match(text,/CONCEPTFACTUUR/);assert.match(text,/END OF FULL DESCRIPTION/);assert.match(text,new RegExp('Normal synthetic visit '+(lines-1)));await loading.destroy();}
 assert.equal((await pdfFixture({mismatch:true})).status,409);
 const sent=await pdfFixture({status:'externally_issued'});assert.equal(sent.status,200);assert.doesNotMatch(sent.headers.get('content-disposition'),/CONCEPT/);
});
