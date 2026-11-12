import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import * as React from 'react';
import * as jsx from 'react/jsx-runtime';
import {renderToStaticMarkup} from 'react-dom/server';
function load(file,stubs={}){const exports={};new Function('exports','require',ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText)(exports,n=>n in stubs?stubs[n]:load(path.resolve(path.dirname(file),n+'.ts'),stubs));return exports;}
const model=load('lib/admin/action-center.ts');
const allRows=load('lib/property-operations/staff-data.ts',{'./staff-work':{}}).allRows;
const today='2026-11-09',uid=n=>'00000000-0000-0000-0000-'+String(n).padStart(12,'0');
const filters=model.actionFilters({});
const invoice=(n,extra={})=>({id:uid(n),source:'rental',issuerId:uid(1),issuer:'MZS',number:'INV-'+n,customer:'Tenant',issuedOn:'2026-11-01',dueOn:'2026-11-01',gross:10000,paid:0,balance:10000,href:'/admin/contracts/invoices/'+uid(n),...extra});
const task=(n,extra={})=>({id:uid(n),relationship_id:uid(8),kind:'task',title:'Follow-up '+n,due_on:today,status:'open',detail:'',created_at:today+'T00:00:00Z',...extra});
const snapshot=(items=[],failures=[],months=[])=>({today,items,failures,months});

test('invoice actions distinguish current debt, unknown payment, credits, settled and future invoices',()=>{
 const rows=model.invoiceActions([invoice(1),invoice(2,{balance:null}),invoice(3,{gross:-100,balance:-100}),invoice(4,{balance:0}),invoice(5,{dueOn:today}),invoice(6,{dueOn:'2026-12-01'}),invoice(7,{dueOn:null}),invoice(8,{source:'archive'})],today);
 assert.deepEqual(rows.map(r=>r.priority),['overdue','review','today','upcoming','review','overdue']);
 assert.equal(rows[1].amountCents,undefined);assert.equal(rows[0].amountCents,10000);assert.deepEqual(rows.at(-1).issues,['recorded_balance','imported_balance']);
 assert.throws(()=>model.invoiceActions([invoice(1),invoice(1)],today));assert.throws(()=>model.invoiceActions([invoice(1,{balance:1.2})],today));assert.throws(()=>model.invoiceActions([invoice(1,{dueOn:'2026-02-30'})],today));
});
test('CRM actions only include open tasks and link to the exact task after validating contact identity',()=>{
 const rows=model.crmActions([task(1),task(2,{kind:'note'}),task(3,{status:'done'}),task(4,{due_on:null})],new Map([[uid(8),'Contact']]),today);
 assert.equal(rows.length,2);assert.equal(rows[1].priority,'review');assert.match(rows[0].href,new RegExp('&activity='+uid(1)+'#activity-'+uid(1)+'$'));
 assert.throws(()=>model.crmActions([task(1)],new Map(),today));assert.throws(()=>model.crmActions([task(1),task(1)],new Map([[uid(8),'Contact']]),today));
});
test('purchase review records retain their issues and are undated, not overdue',()=>{
 const rows=model.purchaseActions([{id:'cost:'+uid(1),label:'Supplier invoice',href:'/admin/workspaces/accountancy/costs?draft='+uid(1),issues:['missing_original','possible_double_entry']}],uid(2),'Mase');
 assert.equal(rows.length,1);assert.equal(rows[0].priority,'review');assert.equal(rows[0].dueOn,null);assert.equal(rows[0].entity,'Mase');assert.equal(rows[0].issues.length,2);
});
test('filters paginate all records, preserve search, count grouped queues, exclude future and never add month cards',()=>{
 const items=model.invoiceActions(Array.from({length:32},(_,i)=>invoice(i+1)),today);
 items.push(...model.crmActions([task(100,{due_on:'2026-12-01'})],new Map([[uid(8),'Contact']]),today),{id:'ops',category:'operations',priority:'review',title:'Work',detail:'',href:'/admin/workspaces/estates/actions',dueOn:null,count:12,kind:'queue'});
 const state=snapshot(items,[],[{id:uid(10),entity:'Mase',report:null,href:'/admin/test'}]);
 const result=model.selectActions(state,{...filters,category:'invoices',q:'mzs',page:999});
 assert.equal(result.total,32);assert.equal(result.page,2);assert.equal(result.rows.length,7);assert.equal(result.counts.find(c=>c.category==='operations').count,12);assert.equal(result.counts.find(c=>c.category==='crm').count,0);assert.equal(items.length,34);
 assert.equal(model.selectActions({...state,failures:[{category:'invoices',source:'unavailable'}]},filters).counts[0].count,null);
 assert.match(model.actionHref({...filters,q:'A & B',category:'crm'},2),/actionSearch=A\+%26\+B&actionPage=2#daily-actions/);
 for(const invalid of [{actionCategory:'invalid'},{actionPriority:'none'},{actionPage:'0'},{actionPage:['1']},{actionSearch:'x'.repeat(101)}])assert.throws(()=>model.actionFilters(invalid));
});
test('sort is deadline-first within priority, stable and does not mutate the source',()=>{
 const items=model.invoiceActions([invoice(2,{dueOn:'2026-11-08'}),invoice(1,{dueOn:'2026-11-01'}),invoice(3,{dueOn:null})],today);
 assert.deepEqual(model.selectActions(snapshot(items),filters).rows.map(r=>r.title),['INV-1','INV-2','INV-3']);assert.equal(items[0].title,'INV-2');
 assert.throws(()=>model.checkedActions([{...items[0],href:'https://evil.test'}]));assert.throws(()=>model.checkedActions([{...items[0],count:0}]));
});
function setup({tables={},fail={},counts={},invoiceRows=[],invoiceError=false,annuals={},queueRows=[],bankError=false,staff=true,notificationCount=0,notificationError=null}={}){
 const calls=[],banks=[],annualCalls=[];
 function query(name){let conditions=[],from=0,to=499;const q={
  select:(...a)=>{calls.push([name,'select',...a]);return q},eq:(k,v)=>{conditions.push(r=>r[k]===v);calls.push([name,'eq',k,v]);return q},in:(k,v)=>{conditions.push(r=>v.includes(r[k]));return q},order:()=>q,range:(a,b)=>{from=a;to=b;return q},returns:()=>q,
  then:(resolve,reject)=>{calls.push([name,'range',from,to]);const rows=(tables[name]??[]).filter(r=>conditions.every(f=>f(r)));return Promise.resolve({data:fail[name]?null:rows.slice(from,to+1),error:fail[name]??null,count:Object.hasOwn(counts,name)?counts[name]:rows.length}).then(resolve,reject)}
 };return q;}
 const db={from:query,rpc:name=>{
  if(name==='mzs_failed_notification_count'){calls.push([name,'rpc']);return Promise.resolve({data:notificationCount,error:notificationError});}
  return query(name);
 }};
 const api=load('lib/admin/action-center-data.ts',{
  '../property-operations/staff-data':{allRows},'../finance/invoice-register':{loadInvoiceRegister:async(db,year)=>{assert.equal(year,null);if(invoiceError)throw Error('invoice unavailable');return invoiceRows}},
  '../accountancy/administration-data':{annualSource:async(db,id)=>{annualCalls.push(id);if(!annuals[id])throw Error('annual unavailable');return annuals[id]}},
  '../accountancy/bank/data':{bankSource:async(db,id)=>{banks.push(id);if(bankError)throw Error('bank unavailable');return{issuer_id:annuals[id].administration.issuer_id}}},
  '../accountancy/month-close-readiness':{monthCloseReadiness:(annual,rows,month,asOf,bank)=>({month,issuer_id:annual.administration.issuer_id,bank:{unallocatedTransactions:bank?0:null},invoices:{unpaidCount:1,unknownBalances:0},purchases:{missingOriginals:1,pendingReview:2}})},
  '../accountancy/completeness':{completenessItems:a=>a.purchase??[]},'../accountancy/purchase-review':{purchaseReviewItems:x=>x},
  '../property-operations/action-queues':{loadQueueCounts:async()=>queueRows,queueHref:key=>'/admin/workspaces/estates/actions?queue='+key},
  '../security/property-staff':{staffEnvironmentAvailable:()=>staff},'./action-center':model
 });
 return{run:includeMonths=>api.loadActionCenter(db,today,includeMonths),calls,banks,annualCalls};
}
const year={id:uid(90),issuer_id:uid(91),fiscal_year:2026,purpose:'current'};
const annualTables={'mzs_accountancy_years':[year],'mzs_lease_issuers':[{id:uid(91),name:'Mase Estates'}]};
const annual={administration:year,purchase:[{id:'cost:1',label:'Cost',href:'/admin/workspaces/accountancy/costs',issues:['missing_original']}]};
test('notification aggregate is exact beyond API page sizes and never reads the private outbox',async()=>{
 for(const count of [0,1,1201]){
  const x=setup({notificationCount:count}),s=await x.run(false);
  assert.equal(model.selectActions(s,filters).counts.find(c=>c.category==='system').count,count);
  assert.equal(s.items.find(i=>i.id==='email:failed')?.count,count||undefined);
  assert.equal(x.calls.filter(c=>c[0]==='mzs_failed_notification_count').length,1);
  assert.ok(!x.calls.some(c=>c[0]==='mzs_mail_outbox'));
 }
});
test('denied, unavailable and invalid notification aggregates remain unknown',async()=>{
 for(const options of [{notificationError:{message:'denied'}},...[-1,1.2,null,'4',[],NaN,Number.MAX_SAFE_INTEGER+1].map(notificationCount=>({notificationCount}))]){
  const s=await setup(options).run(false);
  assert.ok(s.failures.some(f=>f.source==='email'));
  assert.equal(model.selectActions(s,filters).counts.find(c=>c.category==='system').count,null);
  assert.ok(!s.items.some(i=>i.id==='email:failed'));
 }
});
test('loader paginates beyond legacy 12/100 limits, uses scoped RPC and exact counts',async()=>{
 const x=setup({tables:{mzs_crm_activities:Array.from({length:501},(_,i)=>task(i+100)),mzs_lease_relationships:[{id:uid(8),name:'Contact',kind:'person'}],mzs_owner_stay_requests:[{id:uid(1),status:'requested',check_in:today,check_out:'2026-11-10'}],admin_list_rental_bookings:[{id:uid(2),status:'requested',is_test:false,check_in:today,check_out:'2026-11-10'},{id:uid(3),status:'requested',is_test:true}],mzs_capital_admin_list_requests:[{id:uid(5),status:'new',member_name:'Capital'},{id:uid(6),status:'closed'}]},invoiceRows:[invoice(1)]});
 const s=await x.run(false);assert.equal(s.failures.length,0);assert.equal(s.items.filter(i=>i.category==='crm').length,501);assert.equal(s.items.filter(i=>i.category==='requests').length,3);
 assert.ok(x.calls.some(c=>c[0]==='mzs_crm_activities'&&c[1]==='range'&&c[2]===500));assert.ok(!x.calls.some(c=>c[0]==='mzs_capital_requests'));assert.ok(x.calls.filter(c=>c[1]==='select'&&c[0].startsWith('mzs_')&&!c[0].includes('list_requests')).every(c=>c[3]?.count==='exact'));
});
test('failures preserve healthy sources but never replace unknown source counts with zero',async()=>{
 const x=setup({invoiceError:true,fail:{mzs_owner_stay_requests:{message:'denied'}},counts:{mzs_crm_activities:null},queueRows:[{key:'overdue',count:3},{key:'today',count:null}]});
 const s=await x.run(false),view=model.selectActions(s,filters);for(const category of ['invoices','requests','crm','operations'])assert.equal(view.counts.find(c=>c.category===category).count,null);
 assert.equal(s.items.find(i=>i.id==='operations:overdue').count,3);assert.equal(view.counts.find(c=>c.category==='system').count,0);
});
test('legacy capital RPC saturation is detected before filtering and does not claim an exact backlog',async()=>{
 const x=setup({tables:{mzs_capital_admin_list_requests:Array.from({length:300},(_,i)=>({id:uid(i+1),status:'closed'}))}});
 const s=await x.run(false);assert.ok(s.failures.some(f=>f.source==='capital'));assert.equal(model.selectActions(s,filters).counts.find(c=>c.category==='requests').count,null);
});
test('current entity purchases are checked, month cards stay separate, compact skips bank reads',async()=>{
 for(const include of [true,false]){const x=setup({tables:annualTables,annuals:{[year.id]:annual},bankError:true});const s=await x.run(include);
 assert.equal(s.items.length,1);assert.equal(s.items[0].entity,'Mase Estates');assert.equal(s.months.length,include?1:0);assert.equal(x.banks.length,include?1:0);if(include)assert.equal(s.months[0].report.bank.unallocatedTransactions,null);
 assert.equal(model.selectActions(s,filters).counts.find(c=>c.category==='purchases').count,1);}
});
test('cross-entity/year annual data and incomplete administration lists fail closed',async()=>{
 for(const changed of [{issuer_id:uid(99)},{fiscal_year:2025}]){const x=setup({tables:annualTables,annuals:{[year.id]:{...annual,administration:{...year,...changed}}}});const s=await x.run(true);assert.equal(s.items.length,0);assert.equal(s.months[0].report,null);assert.ok(s.failures.some(f=>f.category==='purchases'));assert.equal(x.banks.length,0);}
 const s=await setup({tables:annualTables,counts:{mzs_accountancy_years:2}}).run(true);assert.ok(s.failures.some(f=>f.category==='month'));assert.equal(s.months.length,0);
});
function render(snapshot,compact=false,language='en'){
 const p=load('app/admin/DailyActionCenter.tsx',{'react/jsx-runtime':jsx,'next/link':{default:({prefetch,...props})=>React.createElement('a',props)},'../../lib/admin/i18n-server':{},'../../lib/property-operations/action-queues':{},'../../lib/admin/action-center-data':{},'../../lib/admin/action-center':model,'../../lib/accountancy/completeness':{completenessLabels:{}},'./group-actions.module.css':{default:new Proxy({},{get:(_,k)=>k})}});
 return renderToStaticMarkup(React.createElement(p.ActionCenterView,{snapshot,filters,compact,language,locale:language==='es'?'es-ES':'en-GB'}));
}
test('rendered full and compact views handle unknown sources, escape labels, preserve navigation and Spanish copy',()=>{
 const s=snapshot(model.invoiceActions([invoice(1,{customer:'<script>alert(1)</script>'})],today),[{category:'crm',source:'crm'}]);
 const full=render(s),compact=render(s,true),spanish=render(s,false,'es');
 assert.match(full,/Central Action Center/);assert.match(full,/Incomplete source/);assert.match(full,/&lt;script&gt;/);assert.doesNotMatch(full,/<script>/);assert.match(full,/name="actionPriority"/);assert.match(full,/Monthly review by entity/);assert.match(full,/Refresh overview<\/button>/);
 assert.match(compact,/Today’s priorities/);assert.doesNotMatch(compact,/Worklist|<form|INV-1|Monthly review by entity/);assert.match(spanish,/Centro de acciones/);assert.match(spanish,/Registro incompleto/);
 assert.match(render(snapshot()),/No open items match these filters/);assert.match(render(snapshot([],[{category:'invoices',source:'x'}])),/unavailable lists still need checking/);
});
test('CRM focused links display the exact later-page task, keep paging usable, reject invalid IDs after auth',async()=>{
 const calls=[];const activities=Array.from({length:30},(_,i)=>task(i+100));
 const p=load('app/admin/relationships/activities/page.tsx',{'react/jsx-runtime':jsx,'next/link':{default:'a'},'next/navigation':{notFound:()=>{throw Error('not found')}},'../../../../lib/security/estate-properties':{requireEstateAdmin:async()=>{calls.push('auth');return{db:{}}}},'../../../../lib/estates/read-register':{readRegister:async(db,table)=>{calls.push(table);return table==='mzs_crm_activities'?activities:[{id:uid(8),name:'Contact',kind:'person'}]}},'../../../../lib/admin/i18n-server':{getAdminI18n:async()=>({language:'en',locale:'en-GB'})},'./forms':{CrmActivityCreate:()=>null,CrmTaskUpdate:()=>null},'./activities.module.css':{default:{}}});
 const html=renderToStaticMarkup(await p.default({searchParams:Promise.resolve({relationship:uid(8),activity:uid(128)})}));assert.match(html,new RegExp('id="activity-'+uid(128)+'"'));assert.match(html,/Page 2\/2/);assert.doesNotMatch(html,new RegExp('id="activity-'+uid(100)+'"'));assert.match(html,/← Previous/);assert.equal(calls[0],'auth');calls.length=0;
 await assert.rejects(()=>p.default({searchParams:Promise.resolve({activity:'bad'})}),/not found/);assert.deepEqual(calls,['auth']);
});
test('cockpit authorization happens before any action source renders',async()=>{
 let rendered=false;const p=load('app/admin/workspaces/group/page.tsx',{'react/jsx-runtime':jsx,'react':React,'next/link':{default:'a'},'../../../../lib/admin/i18n-server':{getAdminI18n:async()=>({t:v=>v,language:'en'})},'../../../../lib/security/estate-properties':{requireEstateAdmin:async()=>{throw Error('denied')}},'../../DailyOperations':{default:()=>null},'../../FinancialCockpit':{default:()=>null},'../../GroupActionCenter':{default:()=>{rendered=true;return null}},'../workspace.module.css':{default:{}}});
 await assert.rejects(()=>p.default({searchParams:Promise.resolve({view:'actions'})}),/denied/);assert.equal(rendered,false);
});
