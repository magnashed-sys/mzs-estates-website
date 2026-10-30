import {adminI18nFixture} from './helpers/admin-i18n.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import {createRequire} from 'node:module';
import {PGlite} from '@electric-sql/pglite';
import {createClient} from '@supabase/supabase-js';
const require=createRequire(import.meta.url);
const compile=path=>ts.transpileModule(readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
const staff={};vm.runInNewContext(compile('lib/property-operations/staff-work.ts'),{exports:staff});
const lib={};vm.runInNewContext(compile('lib/property-operations/action-queues.ts'),{exports:lib,Intl,Date,require:()=>staff});
const id=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
const today='2026-10-28';
const pg=new PGlite();
await pg.exec(`
 create table mzs_ops_current_tickets(id uuid,property_id uuid,responsible_profile_id uuid,scheduled_for date,priority text,title text,created_at timestamptz,status text);
 create table mzs_ops_current_visits(id uuid,property_id uuid,profile_id uuid,worked_on date,effective_minutes int,description text,review_decision text,correction_pending bool);
 create table mzs_ops_current_work_orders(id uuid,ticket_id uuid,quotation_reference text,scope_of_work text,created_at timestamptz,decision text);
 create table mzs_estate_properties(id uuid,name text);
 create table profiles(id uuid,full_name text);
 insert into mzs_estate_properties values('${id(100)}','Fictief object');
 insert into profiles values('${id(200)}','Fictieve medewerker');
`);
const ticketStates=[['reported',null,null,'routine'],['reported',null,null,'urgent'],['reopened',null,null,'routine'],['triaged',null,null,'routine'],['triaged','2026-10-29',id(200),'routine'],['scheduled','2026-10-27',id(200),'urgent'],['in_progress','2026-10-27',null,'routine'],['resolved','2026-10-26',id(200),'routine'],['closed','2026-10-26',id(200),'routine'],['scheduled',today,id(200),'routine'],['triaged',today,null,'routine'],['in_progress',null,id(200),'routine']];
for(const [i,[status,date,actor,priority]] of ticketStates.entries())await pg.query('insert into mzs_ops_current_tickets values($1,$2,$3,$4,$5,$6,$7,$8)',[id(i+1),id(100),actor,date,priority,'Fictieve melding '+(i+1),'2026-10-01',status]);
for(const [i,[review,pending]] of [[null,false],['approved',false],['rejected',false],['approved',true],[null,true],[null,false],...Array.from({length:60},()=>[null,false])].entries())await pg.query('insert into mzs_ops_current_visits values($1,$2,$3,$4,$5,$6,$7,$8)',[id(300+i),id(100),id(200),'2026-10-20',45,'Fictief bezoek',review,pending]);
// The live visit view includes optional non-property work areas.
await pg.exec("alter table mzs_ops_current_visits add column work_area_id text; create table mzs_ops_staff_work_areas(id text primary key,name text); insert into mzs_ops_staff_work_areas values('private-magdy','Prive Magdy');");
for(const [i,decision] of ['draft','authorized_internally','cancelled'].entries())await pg.query('insert into mzs_ops_current_work_orders values($1,$2,$3,$4,$5,$6)',[id(400+i),id(6),'Fictieve offerte','Fictieve werkzaamheden','2026-10-20',decision]);
// Execute the real Supabase JS builder against an in-memory SQL fixture. The adapter
// implements only ordinary PostgREST filters/order/paging, not the queue business rules.
const quoted=value=>"'"+String(value).replaceAll("'","''")+"'";
const identifier=value=>{assert.match(value,/^[a-z_]+$/);return '"'+value+'"';};
function split(value){let depth=0,start=0,parts=[];for(let i=0;i<value.length;i++){if(value[i]==='(')depth++;if(value[i]===')')depth--;if(value[i]===','&&depth===0){parts.push(value.slice(start,i));start=i+1;}}parts.push(value.slice(start));return parts;}
function expression(value){
 const group=value.match(/^(and|or)\((.*)\)$/);
 if(group)return '('+split(group[2]).map(expression).join(group[1]==='and'?' AND ':' OR ')+')';
 if(value.includes('.not.is.null'))return identifier(value.split('.')[0])+' IS NOT NULL';
 const [,field,op,raw]=value.match(/^([a-z_]+)\.(eq|is|lt|gte|in)\.(.*)$/)??[];assert.ok(field,'Unsupported predicate: '+value);
 if(op==='is'){assert.equal(raw,'null');return identifier(field)+' IS NULL';}
 if(op==='in')return identifier(field)+' IN ('+split(raw.slice(1,-1)).map(quoted).join(',')+')';
 return identifier(field)+({eq:' = ',lt:' < ',gte:' >= '})[op]+quoted(raw);
}
function database({failTable,missingLabels=false,missingCount=false}={}){
 const calls=[];
 const db=createClient('https://fixture.invalid','sb_publishable_fixture',{auth:{persistSession:false,autoRefreshToken:false},global:{fetch:async(url,options)=>{
  const u=new URL(url),table=u.pathname.split('/').at(-1),head=options.method==='HEAD';calls.push({table,head,query:u.search});
  if(table===failTable)return new Response(JSON.stringify({message:'Synthetic unavailable source'}),{status:503});
  const predicates=[];for(const [key,value] of u.searchParams){if(['select','order','limit','offset'].includes(key))continue;predicates.push(expression(key==='or'?'or'+value:key+'.'+value));}
  const where=predicates.length?' WHERE '+predicates.join(' AND '):'';
  const count=Number((await pg.query('select count(*)::int as n from '+identifier(table)+where)).rows[0].n);
  const offset=Number(u.searchParams.get('offset')??0),limit=Number(u.searchParams.get('limit')??1000);
  if(offset>0&&offset>=count)return new Response(JSON.stringify({code:'PGRST103',message:'Out of range'}),{status:416});
  const order=u.searchParams.get('order')?.split(',').map(x=>{const [field,dir]=x.split('.');return identifier(field)+(dir==='desc'?' DESC':' ASC');}).join(',');
  const select=u.searchParams.get('select').split(',').map(identifier).join(',');
  const rows=head?[]:(await pg.query('select '+select+' from '+identifier(table)+where+(order?' ORDER BY '+order:'')+' LIMIT '+limit+' OFFSET '+offset)).rows;
  const headers={'Content-Type':'application/json'};if(!missingCount)headers['Content-Range']='0-'+Math.max(0,rows.length-1)+'/'+count;
  return new Response(head?null:JSON.stringify(missingLabels&&table==='profiles'?[]:rows),{status:200,headers});
 }}});
 return {db,calls};
}

test('action queues classify current work without counting corrections, overdue work or closed cases twice',async()=>{
 const {db,calls}=database(),counts=await lib.loadQueueCounts(db,today);
 assert.deepEqual(Object.fromEntries(counts.map(x=>[x.key,x.count])),{overdue:2,triage:3,today:1,planning:3,closure:1,corrections:2,visits:62,budgets:1});
 assert.ok(calls.every(c=>c.head));
 const overdue=await lib.loadQueuePage(db,'overdue',1,today),planning=await lib.loadQueuePage(db,'planning',1,today);
 assert.deepEqual(Array.from(overdue.items,x=>x.id),[id(6),id(7)]);
 assert.deepEqual(Array.from(planning.items,x=>x.id),[id(4),id(11),id(12)]);
 assert.equal(overdue.items[0].property,'Fictief object');assert.equal(overdue.items[0].person,'Fictieve medewerker');assert.equal(overdue.items[1].person,'Not yet assigned');
 const due=await lib.loadQueuePage(db,'today',1,today);assert.deepEqual(Array.from(due.items,x=>x.id),[id(10)]);
 const triage=await lib.loadQueuePage(db,'triage',1,today);assert.equal(triage.items[0].id,id(2));assert.equal(triage.items[0].urgent,true);
});
test('queue totals remain exact beyond a page and a stale page recovers the final page',async()=>{
 const {db}=database(),page=await lib.loadQueuePage(db,'visits',3,today);
 assert.equal(page.total,62);assert.equal(page.items.length,12);assert.equal(page.pages,3);
 const recovered=await lib.loadQueuePage(db,'visits',999,today);assert.equal(recovered.page,3);assert.deepEqual(recovered.items,page.items);
 assert.match(page.items[0].href,/inbox=visits&inboxPage=3#visit$/);
});
test('budget actions link to their actual maintenance dossier, retain queue context and do not present budgets as costs',async()=>{
 const {db}=database(),page=await lib.loadQueuePage(db,'budgets',1,today);
 assert.equal(page.items.length,1);assert.equal(page.items[0].title,'Fictieve offerte');assert.equal(page.items[0].property,'Fictief object');
 assert.ok(page.items[0].href.includes('ticket='+id(6)));assert.ok(page.items[0].href.endsWith('#work-orders'));
 assert.ok(!Object.hasOwn(page.items[0],'amount'));
});
test('unknown counts never become zero and missing dossier labels fail the whole page',async()=>{
 const counts=await lib.loadQueueCounts(database({failTable:'mzs_ops_current_visits'}).db,today);
 assert.equal(counts.find(x=>x.key==='visits').count,null);assert.equal(counts.find(x=>x.key==='overdue').count,2);
 const unknown=await lib.loadQueueCounts(database({missingCount:true}).db,today);assert.ok(unknown.every(x=>x.count===null));
 await assert.rejects(lib.loadQueuePage(database({missingLabels:true}).db,'visits',1,today),/Dossier data/);
 await assert.rejects(lib.loadQueuePage(database({failTable:'mzs_ops_current_visits'}).db,'visits',1,today),/fully loaded/);
});
test('planning day uses Madrid midnight, including summer/winter DST; URL inputs stay canonical',()=>{
 assert.equal(lib.operationsDay(new Date('2026-10-28T23:30:00Z')),'2026-10-29');
 assert.equal(lib.operationsDay(new Date('2026-06-01T22:30:00Z')),'2026-06-02');
 assert.equal(lib.operationsDay(new Date('2026-10-25T22:30:00Z')),'2026-10-25');
 assert.equal(lib.queueKey(['visits']),null);assert.equal(lib.queueKey('visits&other=1'),null);
 assert.equal(lib.queueHref('visits',Infinity),'/admin/workspaces/estates/actions?queue=visits&page=1');
 assert.throws(()=>lib.dossierHref('visits','javascript:alert(1)'),/Invalid/);
});
test('action page checks environment and active administrator before reading queues',async()=>{
 for(const deny of ['environment','admin']){
  const exports={},calls=[];
  vm.runInNewContext(compile('app/admin/workspaces/estates/actions/page.tsx'),{exports,require(name){if(name.includes('/admin/i18n'))return adminI18nFixture();
   if(name==='react/jsx-runtime')return require(name);
   if(name.includes('security/property-staff'))return {requireStaffEnvironment(){calls.push('environment');if(deny==='environment')throw Error('denied');}};
   if(name.includes('security/estate-properties'))return {async requireEstateAdmin(){calls.push('admin');throw Error('denied');}};
   if(name.includes('action-queues'))return {loadQueuePage(){calls.push('query');}};
   return {};
  }});
  await assert.rejects(exports.default({searchParams:Promise.resolve({})}),/denied/);
  assert.deepEqual(calls,deny==='environment'?['environment']:['environment','admin']);
 }
});
test('successful operation invalidation refreshes both dashboards and the complete queue',()=>{
 const paths=[],exports={};vm.runInNewContext(compile('lib/property-operations/revalidate.ts'),{exports,require:()=>({revalidatePath:path=>paths.push(path)})});
 exports.revalidateOperations();assert.deepEqual(paths,['/staff','/admin/workspaces/estates/staff','/admin/workspaces/estates/actions','/admin/workspaces/estates/time-report','/admin/workspaces/estates','/admin/workspaces/group']);
});
test('time action queues support work-area visits without inventing a property dossier',async()=>{
 await pg.query('insert into mzs_ops_current_visits(id,property_id,profile_id,worked_on,effective_minutes,description,review_decision,correction_pending,work_area_id) values($1,null,$2,$3,$4,$5,null,false,$6)',[
  id(899),id(200),'2026-10-19',45,'Private work area review','private-magdy'
 ]);
 const {db}=database();
 const page=await lib.loadQueuePage(db,'visits',1,today);
 const result=page.items.find(x=>x.id===id(899));
 assert.ok(result);assert.equal(result.property,'Prive Magdy');assert.equal(result.person,'Fictieve medewerker');
 assert.ok(result.href.includes('visit='+id(899)));
});
test.after(async()=>{await pg.close();});
