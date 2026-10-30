import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import vm from 'node:vm';
import ts from 'typescript';
const require=createRequire(import.meta.url);
const read=p=>readFileSync(p,'utf8');
test('week schema locks ISO closeouts and has scoped immutable event and snapshot access',()=>{
 const sql=read('supabase/migrations/20261030130000_ops_weekly_closeout.sql');
 assert.match(sql,/mzs_ops_week_events/);
 assert.match(sql,/mzs_ops_week_entries/);
 assert.match(sql,/enable row level security/g);
 assert.match(sql,/mzs_ops_current_week_closures/);
 assert.match(sql,/pg_advisory_xact_lock/);
 assert.match(sql,/mzs_ops_staff_visits/);
 assert.match(sql,/mzs_ops_visit_correction_requests/);
 assert.match(sql,/mzs_ops_visit_correction_decisions/);
 assert.match(sql,/mzs_ops_visit_reviews/);
 assert.match(sql,/mzs_ops_approve_week_visits/);
 assert.match(sql,/mzs_ops_close_staff_week/);
 assert.match(sql,/mzs_ops_reopen_staff_week/);
 assert.match(sql,/mzs_ops_zorgbalans_invoice_lines/);
 assert.match(sql,/p_week_start\+6 >=\(now\(\) at time zone 'Europe\/Madrid'\)::date/);
 assert.doesNotMatch(sql,/grant (update|delete) on public\.mzs_ops_week_events/i);
});
test('releases require exact admin and completed approved data; no automatic customer billing',()=>{
 const a=read('app/admin/workspaces/estates/weekly/actions.ts');
 const ui=read('app/admin/workspaces/estates/weekly/page.tsx');
 const route=read('app/api/admin/staff-week/export/route.ts');
 assert.match(a,/requireEstateAdmin/);assert.match(a,/requireStaffEnvironment/);
 assert.match(a,/ids\.length>100/);assert.match(a,/Set\(ids\)/);
 assert.match(ui,/v\.review_decision==='approved'&&!v\.correction_pending/);
 assert.match(ui,/sunday<today/);
 assert.match(ui,/mzs_ops_current_week_closures/);
 assert.match(route,/requireEstateAdmin/);assert.match(route,/event\.action!=='closed'/);
 assert.match(route,/entries\.reduce/);assert.match(route,/visit_count/);
 assert.doesNotMatch(a+/route/,/nodemailer|mzs_ops_prepare_zorgbalans_invoice/);
});
test('genuine xlsx contains reconciled frozen minutes and safe escaped strings',()=>{
 const js=ts.transpileModule(read('lib/property-operations/week-export.ts'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const exports={};vm.runInNewContext(js,{exports,require,Buffer,Uint8Array,Math,String,Number});
 const report={name:'Synthetic & Staff',week:'2026-10-19',closedAt:'2026-10-26T09:00:00Z',
  approvedBy:'Administrator',closeNote:'Reviewed demo week',eventId:'00000000-0000-4000-8000-000000000001',
  totalMinutes:118,rows:[{worked_on:'2026-10-20',location:'Property <demo>',unit:'',
    category:'cleaning',description:'Synthetic A & B',actual_minutes:45,approved_minutes:45,visit_id:'demo-1'},
    {worked_on:'2026-10-22',location:'Other',unit:'',category:'maintenance',
    description:'Remaining time',actual_minutes:73,approved_minutes:73,visit_id:'demo-2'}]};
 const file=exports.weekWorkbook(report);
 assert.equal(file.readUInt32LE(0),0x04034b50);
 assert.equal(file.readUInt32LE(file.length-22),0x06054b50);
 assert.ok(file.includes(Buffer.from('xl/worksheets/sheet1.xml')));
 assert.ok(file.includes(Buffer.from('Property &lt;demo&gt;')));
 assert.ok(file.includes(Buffer.from('Synthetic A &amp; B')));
 assert.ok(file.includes(Buffer.from('118')));
 assert.ok(!file.includes(Buffer.from('EUR')));
});
