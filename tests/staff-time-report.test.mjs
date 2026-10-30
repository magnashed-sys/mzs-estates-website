import {adminI18nFixture} from './helpers/admin-i18n.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {createRequire} from 'node:module';
import vm from 'node:vm';
import ts from 'typescript';
const require=createRequire(import.meta.url);
const compile=path=>ts.transpileModule(readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
const modules={};for(const name of ['staff-work','finance','action-queues','time-report']){const exports={};vm.runInNewContext(compile('lib/property-operations/'+name+'.ts'),{exports,Date,Intl,URLSearchParams,require:n=>modules[n.replace('./','')]});modules[name]=exports;}
const lib=modules['time-report'],id=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
const filters=()=>lib.timeFilters({from:'2026-09-01',until:'2026-10-31'});
const row=(n,fields={})=>({id:id(n),property_id:id(101),work_area_id:null,unit_id:null,task_id:null,profile_id:id(201),worked_on:'2026-10-01',actual_minutes:45,effective_minutes:45,task_category:'cleaning',description:'Synthetic visit',correction_id:null,review_decision:null,reviewed_at:null,correction_pending:false,...fields});
const fixture=()=>({schema_version:2,from:'2026-09-01',until:'2026-10-31',property:null,area:null,profile:null,generated_at:'2026-10-28T19:00:00Z',record_count:6,properties:[{id:id(101),name:'Object A'},{id:id(102),name:'Object B'}],areas:[{id:'private-magdy',name:'Prive Magdy'},{id:'maintenance-beverwijk',name:'Onderhoud Beverwijk'}],units:[{id:id(401),property_id:id(101),address:'Unit A'}],people:[{id:id(201),full_name:'Same name'},{id:id(202),full_name:'Same name'}],visits:[row(1),row(2,{review_decision:'approved',reviewed_at:'2026-10-02T00:00:00Z',correction_pending:true}),row(3,{effective_minutes:71,correction_id:id(301),review_decision:'approved',reviewed_at:'2026-10-02T00:00:00Z'}),row(4,{review_decision:'rejected',reviewed_at:'2026-10-02T00:00:00Z'}),row(5,{property_id:id(102),worked_on:'2026-09-30'}),row(6,{property_id:id(102),profile_id:id(202)})]});
const clean=x=>JSON.parse(JSON.stringify(x));

test('time filters use Madrid month boundaries, validate real dates and allow at most 366 inclusive days',()=>{
 assert.deepEqual(clean(lib.timeFilters({},new Date('2026-10-31T23:30:00Z'))),{from:'2026-11-01',until:'2026-11-01',property:'',area:'',profile:'',page:1});
 assert.equal(lib.timeFilters({},new Date('2026-06-30T22:30:00Z')).from,'2026-07-01');
 assert.equal(lib.timeFilters({from:'2024-01-01',until:'2024-12-31'}).until,'2024-12-31');
 for(const params of [{from:'2026-02-29'},{from:'2024-01-01',until:'2025-01-01'},{from:'2026-10-02',until:'2026-10-01'},{from:['2026-01-01','2026-02-01']},{property:['']},{area:['']},{area:'../../private'},{location:'area:private-magdy',property:id(101)},{property:id(101),area:'private-magdy'},{profile:'not-a-uuid'},{from:'1999-01-01'},{until:''}])assert.throws(()=>lib.timeFilters(params));
 assert.equal(lib.timeFilters({page:'-1'}).page,1);
});
test('reports keep exact source minutes and mutually exclusive correction/review totals across all groups',()=>{
 const report=lib.normalizeTimeReport(fixture(),filters());
 assert.equal(report.total.count,6);assert.equal(report.total.minutes,296);assert.equal(report.total.originalMinutes,270);
 assert.deepEqual(clean(report.total.approved),{count:1,minutes:71});assert.deepEqual(clean(report.total.correction),{count:1,minutes:45});assert.equal(report.total.pending.minutes,135);assert.equal(report.total.returned.minutes,45);
 assert.equal(report.byPerson.length,2);assert.equal(report.byWeek.length,1);assert.equal(report.byWeek[0][0],'2026-09-28');assert.equal(report.byPerson.find(([key])=>key===id(201))[1].minutes,251);
 assert.equal(report.byLocation.find(([key])=>key==='property:'+id(102))[1].minutes,90);assert.equal(report.byProperty.find(([key])=>key===id(102))[1].minutes,90);assert.equal(report.byMonth.find(([key])=>key==='2026-09')[1].minutes,45);
 assert.equal(lib.workDuration(93),'1:33');assert.equal(lib.workDuration(96000),'1600:00');assert.throws(()=>lib.workDuration(1.5));
});
test('incomplete or contradictory snapshots fail as a whole instead of generating plausible partial totals',()=>{
 const mutations=[s=>s.record_count--,s=>s.visits.push(s.visits[0]),s=>s.people.pop(),s=>s.properties=[],s=>s.visits[0].worked_on='2026-11-01',s=>s.visits[0].actual_minutes=45.5,s=>s.visits[0].effective_minutes=9601,s=>s.visits[0].effective_minutes=46,s=>s.visits[0].review_decision='unknown',s=>s.visits[0].review_decision='approved',s=>s.visits[0].correction_pending=undefined,s=>s.visits[0].correction_id='invalid',s=>s.generated_at='bad',s=>s.profile=id(201),s=>s.people.push(s.people[0]),s=>s.properties[0].name=123];
 for(const mutate of mutations){const source=fixture();mutate(source);assert.throws(()=>lib.normalizeTimeReport(source,filters()),/incomplete/);}
});
test('dossier navigation retains the report period, person, property and page without accepting external returns',()=>{
 const f={...filters(),property:id(101),profile:id(201),page:3},href=lib.timeDossierHref(f,id(1)),params=Object.fromEntries(new URL(href,'https://fixture.invalid').searchParams);
 assert.equal(lib.timeReturnHref(params),lib.timeReportHref(f,3)+'#visits');assert.ok(!lib.timeReportHref(f,3,true).includes('page='));
 assert.equal(lib.timeReturnHref({...params,reportFrom:'https://malicious.invalid'}),null);assert.equal(lib.timeReturnHref({...params,reportPage:['3','4']}),null);assert.throws(()=>lib.timeDossierHref(f,'javascript:alert(1)'));
});
function parseCsv(text){let rows=[],row=[],cell='',quoted=false;for(let i=1;i<text.length;i++){let c=text[i];if(c==='"'){if(quoted&&text[i+1]==='"'){cell+='"';i++;}else quoted=!quoted;}else if(c===','&&!quoted){row.push(cell);cell='';}else if(c==='\r'&&text[i+1]==='\n'&&!quoted){row.push(cell);rows.push(row);row=[];cell='';i++;}else cell+=c;}if(row.length||cell){row.push(cell);rows.push(row);}return rows;}
test('CSV contains exact original/current/approved minutes, provenance and safely escaped spreadsheet text',()=>{
 const source=fixture();source.properties[0].name='=1+1';source.visits[0].description='@SUM(1,2)\n"note"';
 const csv=lib.timeReportCsv(lib.normalizeTimeReport(source,filters()));assert.equal(csv.charCodeAt(0),0xfeff);
 const [header,...rows]=parseCsv(csv),records=rows.map(row=>Object.fromEntries(header.map((key,i)=>[key,row[i]])));
 assert.equal(records.length,6);const pending=records.find(v=>v.visit_id===id(2)),approved=records.find(v=>v.visit_id===id(3));
 assert.equal(pending.approved_minutes,'0');assert.equal(pending.report_state,'correction');assert.equal(pending.last_review_decision,'approved');assert.equal(approved.original_minutes,'45');assert.equal(approved.current_minutes,'71');assert.equal(approved.approved_minutes,'71');assert.equal(approved.current_hours_minutes,'1:11');
 assert.equal(approved.snapshot_at,source.generated_at);assert.equal(approved.period_from,source.from);assert.equal(approved.property,"'=1+1");assert.equal(records.find(v=>v.visit_id===id(1)).description,'\'@SUM(1,2)\n"note"');assert.ok(!header.some(h=>/rate|wage|billable|amount/.test(h)));
});
function route({environment=true,denied=false,source=fixture(),csv,queryFailure=false}={}){
 const exports={},calls=[];vm.runInNewContext(compile('app/admin/workspaces/estates/time-report/export/route.ts'),{exports,Response,URL,Buffer,require(name){if(name.includes('/admin/i18n'))return adminI18nFixture();
  if(name.includes('property-staff'))return {staffEnvironmentAvailable:()=>{calls.push('environment');return environment;}};
  if(name.includes('estate-properties'))return {requireEstateAdmin:async()=>{calls.push('admin');if(denied)throw Error('denied');return {db:{rpc:async()=>{calls.push('query');return {data:source,error:queryFailure?{message:'unavailable'}:null};}}};}};
  if(name.includes('time-report'))return {...lib,...(csv?{timeReportCsv:()=>csv}:{})};throw Error('unexpected import '+name);
 }});return {get:query=>exports.GET({url:'https://fixture.invalid/export?'+(query??'from=2026-09-01&until=2026-10-31')}),calls};
}
test('time export guards access before input/query and returns private complete CSV',async()=>{
 const off=route({environment:false});assert.equal((await off.get()).status,404);assert.deepEqual(off.calls,['environment']);
 const denied=route({denied:true});await assert.rejects(denied.get(),/denied/);assert.deepEqual(denied.calls,['environment','admin']);
 const ok=route(),response=await ok.get();assert.equal(response.status,200);assert.equal(response.headers.get('Cache-Control'),'private, no-store');assert.equal(response.headers.get('X-Content-Type-Options'),'nosniff');assert.match(response.headers.get('Content-Disposition'),/MZS-Time-2026-09-01-2026-10-31.csv/);assert.equal(parseCsv('\ufeff'+await response.text()).length,7);assert.deepEqual(ok.calls,['environment','admin','query']);
});
test('export errors reject duplicate filters, unavailable or incomplete sources and oversize output without partial CSV',async()=>{
 const invalid=route();assert.equal((await invalid.get('from=2026-09-01&from=2026-10-01')).status,400);assert.ok(!invalid.calls.includes('query'));
 assert.equal((await route({queryFailure:true}).get()).status,503);
 const source=fixture();source.record_count=7;assert.equal((await route({source}).get()).status,503);
 const large=await route({csv:'x'.repeat(4*1024*1024+1)}).get();assert.equal(large.status,413);assert.ok(!large.headers.has('Content-Disposition'));
});
function page({denied,source=fixture()}={}){
 const exports={},calls=[];vm.runInNewContext(compile('app/admin/workspaces/estates/time-report/page.tsx'),{exports,Date,Intl,require(name){if(name.includes('/admin/i18n'))return adminI18nFixture();
  if(name==='react/jsx-runtime')return require(name);if(name==='next/link')return {default:'a'};if(name==='next/navigation')return {redirect:href=>{throw Error('redirect:'+href);}};
  if(name.includes('property-staff'))return {requireStaffEnvironment(){calls.push('environment');if(denied==='environment')throw Error('denied');}};
  if(name.includes('estate-properties'))return {async requireEstateAdmin(){calls.push('admin');if(denied==='admin')throw Error('denied');return {db:{rpc:async()=>{calls.push('query');return {data:source,error:null};}}};}};
  if(name.includes('time-report'))return lib;if(name.endsWith('.css'))return {default:{}};return {};
 }});return {render:params=>exports.default({searchParams:Promise.resolve({from:'2026-09-01',until:'2026-10-31',...params})}),calls};
}
test('report page checks environment/admin before fetching private source data',async()=>{
 for(const denied of ['environment','admin']){const p=page({denied});await assert.rejects(p.render(),/denied/);assert.deepEqual(p.calls,denied==='admin'?['environment','admin']:['environment']);}
});
test('report pagination retains complete totals while showing only the chosen 25 visits and recovers stale pages',async()=>{
 const source=fixture();source.visits=Array.from({length:61},(_,i)=>row(i+1));source.record_count=61;
 const p=page({source}),tree=await p.render({page:'3'}),elements=[];function walk(x){if(!x||typeof x!=='object')return;if(Array.isArray(x))return x.forEach(walk);elements.push(x);walk(x.props?.children);}walk(tree);
 assert.equal(elements.filter(e=>e.props?.href?.includes('/staff?visit=')).length,11);
 const serialized=JSON.stringify(tree);assert.match(serialized,/45:45/);assert.match(serialized,/totals above cover all/);
 await assert.rejects(p.render({page:'999'}),/redirect:.*from=2026-09-01&until=2026-10-31&page=3/);
});
test('Time Report 2.0 separates operational work areas, units, ISO weeks and safe CSV values',()=>{
 const source=fixture();
 source.visits[0]={...source.visits[0],property_id:null,work_area_id:'private-magdy',task_id:id(501),description:'=HYPERLINK("bad")'};
 source.visits[1]={...source.visits[1],unit_id:id(401),worked_on:'2026-10-05'};
 const report=lib.normalizeTimeReport(source,filters());
 assert.equal(report.total.count,6);
 assert.equal(report.byLocation.find(([key])=>key==='area:private-magdy')[1].minutes,45);
 assert.equal(report.byProperty.reduce((n,[,v])=>n+v.count,0),5);
 assert.equal(report.byUnit.find(([key])=>key===id(101)+':'+id(401))[1].count,1);
 assert.deepEqual(report.byWeek.map(([key])=>key),['2026-09-28','2026-10-05']);
 const area=report.visits.find(v=>v.work_area_id==='private-magdy');
 assert.equal(area.property_id,null);assert.equal(area.location_name,'Prive Magdy');
 assert.equal(area.location_kind,'area');assert.equal(area.week_start,'2026-09-28');
 const csv=lib.timeReportCsv(report);
 const [header,...body]=parseCsv(csv);
 const records=body.map(row=>Object.fromEntries(header.map((key,i)=>[key,row[i]])));
 const areaExport=records.find(v=>v.visit_id===area.id);
 assert.equal(areaExport.work_area_id,'private-magdy');
 assert.equal(areaExport.location_type,'area');
 assert.equal(areaExport.property_id,'');
 assert.equal(areaExport.week_start,'2026-09-28');
 assert.equal(areaExport.task_id,id(501));
 assert.equal(areaExport.description,"'=HYPERLINK(\"bad\")");
 const unitRecord=records.find(v=>v.visit_id===id(2));
 assert.equal(unitRecord.unit_id,id(401));assert.equal(unitRecord.unit,'Unit A');
});
test('operational filters preserve safe links and reject invalid or incomplete snapshots',()=>{
 const source=fixture();source.visits=[row(1,{property_id:null,work_area_id:'private-magdy'})];source.record_count=1;source.area='private-magdy';
 const f=lib.timeFilters({from:'2026-09-01',until:'2026-10-31',location:'area:private-magdy'});
 const report=lib.normalizeTimeReport(source,f);
 assert.equal(report.total.minutes,45);
 assert.ok(lib.timeReportHref(f,1,true).includes('area=private-magdy'));
 const href=lib.timeDossierHref(f,id(1));
 const params=Object.fromEntries(new URL(href,'https://test.invalid').searchParams);
 assert.equal(lib.timeReturnHref(params),lib.timeReportHref(f)+'#visits');
 for(const mutation of [
  s=>s.visits[0].property_id=id(101),
  s=>s.visits[0].work_area_id='unregistered-area',
  s=>s.visits[0].unit_id=id(401),
  s=>s.areas=[],
  s=>s.schema_version=1,
  s=>s.area=null
 ]){const clone=clean(source);mutation(clone);assert.throws(()=>lib.normalizeTimeReport(clone,f),/incomplete/);}
 assert.equal(lib.weekStart('2026-01-01'),'2025-12-29');
});
test('time snapshot RPC enforces real PostgreSQL access, revisions, filters and capacity limits',()=>{
 const result=spawnSync(process.execPath,['tests/db/staff-time-report.cjs'],{encoding:'utf8',timeout:120000});assert.equal(result.status,0,result.stdout+'\n'+result.stderr);
});
