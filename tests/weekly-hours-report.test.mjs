import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import vm from 'node:vm';import ts from 'typescript';
function load(path,deps={}){const exports={};vm.runInNewContext(ts.transpileModule(readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,Intl,Date,Map,Set,require:n=>deps[n]});return exports;}
const r=load('lib/mzs/weekly-hours-report.ts',{'./visitor-report':load('lib/mzs/visitor-report.ts')});
test('Monday 07 Madrid only, including both DST switches and year boundary',()=>{
 for(const [now,week] of [['2026-11-02T06:00:00Z','2026-10-26'],['2026-03-30T05:00:00Z','2026-03-23'],['2026-10-26T06:00:00Z','2026-10-19'],['2027-01-04T06:00:00Z','2026-12-28']])assert.equal(r.hoursWindow(new Date(now)).week,week);
 for(const now of ['2026-11-02T05:00Z','2026-03-30T06:00Z','2026-11-03T08:00Z'])assert.equal(r.hoursWindow(new Date(now)),null);
});
test('All staff remain separate, exact totals, late work links, statuses and escaping',()=>{
 const row={id:'1',profile_id:'a',name:'<script>A</script>',location:'Zorgbalans',unit:null,worked_on:'2026-10-20',created_at:'2026-10-27T10:00:00Z',actual_minutes:61,effective_minutes:50,description:'<img src=x>',review_decision:null,correction_pending:true};
 const m=r.weeklyHoursReport('2026-10-26',[row,{...row,id:'2',profile_id:'b',actual_minutes:31,review_decision:'approved'},{...row,id:'3',profile_id:'c',actual_minutes:28,review_decision:'rejected'}]);
 assert.match(m.text,/2 uur 00 min/);assert.match(m.text,/later ingediend/);assert.match(m.text,/profile=a&week=2026-10-19/);assert.match(m.text,/Goedgekeurd/);assert.match(m.text,/Afgewezen/);assert.match(m.text,/Open correctie/);assert.match(m.text,/Nog te beoordelen/);assert.doesNotMatch(m.html,/<script>|<img/);assert.match(m.html,/&lt;script/);
 assert.throws(()=>r.weeklyHoursReport('2026-10-26',[row,row]));assert.match(r.weeklyHoursReport('2026-10-26',[]).text,/Geen uren ingediend/);
});
