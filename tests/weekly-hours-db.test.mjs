import test from 'node:test';import assert from 'node:assert/strict';import {PGlite} from '@electric-sql/pglite';import {readFileSync} from 'node:fs';
test('Private snapshot selects submission week, latest approved correction, all rows, and rejects public callers',async()=>{
 const db=new PGlite();try{
 await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;
 create table profiles(id uuid primary key,full_name text,email text);
 create table mzs_estate_properties(id uuid,name text);
 create table mzs_estate_units(id uuid,address text);
 create table mzs_ops_staff_work_areas(id text,name text);
 create table mzs_ops_staff_visits(id uuid,profile_id uuid,property_id uuid,unit_id uuid,worked_on date,actual_minutes int,description text,created_at timestamptz,work_area_id text);
 create table mzs_ops_visit_correction_requests(id uuid,visit_id uuid,proposed_minutes int,sequence_no bigint);
 create table mzs_ops_visit_correction_decisions(correction_id uuid,decision text);
 create table mzs_ops_visit_reviews(visit_id uuid,correction_id uuid,decision text);
 insert into profiles values('00000000-0000-0000-0000-000000000001','Worker','worker@example.invalid');
 insert into mzs_ops_staff_work_areas values('zorgbalans','Zorgbalans');
 insert into mzs_ops_staff_visits select md5(i::text)::uuid,'00000000-0000-0000-0000-000000000001',null,null,'2026-10-01',61,'work','2026-10-19T00:00:00+02','zorgbalans' from generate_series(1,1001)i;
 insert into mzs_ops_staff_visits values(md5('excluded')::uuid,'00000000-0000-0000-0000-000000000001',null,null,'2026-10-20',600,'excluded','2026-10-26T00:00:00+01',null);
 insert into mzs_ops_visit_correction_requests values(md5('correction')::uuid,md5('1')::uuid,45,1),(md5('pending')::uuid,md5('1')::uuid,30,2);
 insert into mzs_ops_visit_correction_decisions values(md5('correction')::uuid,'approved');
 insert into mzs_ops_visit_reviews values(md5('1')::uuid,md5('correction')::uuid,'approved');`);
 await db.exec(readFileSync('supabase/migrations/20261102093214_weekly_hours_digest.sql','utf8'));
 for(const role of ['anon','authenticated']){await db.exec('set role '+role);await assert.rejects(db.query("select mzs_weekly_hours_summary('2026-10-19')"),/permission denied/);await assert.rejects(db.query('select * from mzs_weekly_hours_reports'),/permission denied/);}
 await db.exec('set role service_role');
 const rows=(await db.query("select mzs_weekly_hours_summary('2026-10-19') as entries")).rows[0].entries;
 assert.equal(rows.length,1001);assert.equal(rows.reduce((n,r)=>n+r.actual_minutes,0),61061);
 const corrected=rows.find(r=>r.correction_pending);assert.equal(corrected.effective_minutes,45);assert.equal(corrected.review_decision,'approved');assert.equal(corrected.location,'Zorgbalans');assert.equal(corrected.worked_on,'2026-10-01');
 await assert.rejects(db.query("select mzs_weekly_hours_summary('2026-10-20')"),/Monday/);
 const insert="insert into mzs_weekly_hours_reports(week_start,recipient_user_id,status) values('2026-10-19','00000000-0000-0000-0000-000000000001','sending')";
 await db.exec(insert);await assert.rejects(db.exec(insert),/duplicate key/);
 }finally{await db.close();}
});
