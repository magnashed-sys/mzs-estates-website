import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=path=>readFileSync(path,'utf8');

test('Catherine prelaunch history is an isolated, owner-only, read-only archive',()=>{
 const sql=read('supabase/migrations/20261030113000_catherine_legacy_week_history.sql');
 assert.match(sql,/mzs_ops_staff_legacy_history/);
 assert.match(sql,/enable row level security/);
 assert.match(sql,/\(select auth\.uid\(\)\)\s*=\s*profile_id/);
 assert.match(sql,/p\.is_active/);
 assert.match(sql,/grant select on public\.mzs_ops_staff_legacy_history to authenticated/);
 assert.doesNotMatch(sql,/grant (insert|update|delete) on public\.mzs_ops_staff_legacy_history to authenticated/i);
 assert.match(sql,/period_until\s*<\s*date '2026-10-26'/);
 assert.match(sql,/ledders2@hotmail\.com/);
 assert.doesNotMatch(sql,/insert into public\.mzs_ops_staff_visits/i);
 assert.doesNotMatch(sql,/update public\.mzs_ops_historical_cost_rows/i);
});

test('Staff History shows source-derived weekly closures without billing or invented minutes',()=>{
 const page=read('app/staff/page.tsx');
 const ui=read('app/staff/LegacyWeekHistory.tsx');
 assert.match(page,/db\.from\('mzs_ops_staff_legacy_history'\)/);
 assert.match(page,/<LegacyWeekHistory rows=\{legacyRows\} language=\{language\}\/>/);
 assert.match(ui,/period_from/);assert.match(ui,/period_until/);assert.match(ui,/original_location/);
 assert.match(ui,/source_reference/);
 assert.match(ui,/notExact/);
 assert.doesNotMatch(ui,/cost_cents|recharge_cents|billed_hours|actual_minutes/);
 assert.match(ui,/nl:/);assert.match(ui,/en:/);assert.match(ui,/es:/);
});
