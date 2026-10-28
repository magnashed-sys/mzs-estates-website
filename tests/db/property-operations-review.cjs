// Runs the un-applied Property Operations schema DESIGN in an in-memory PGlite DB.
// Never connects to any Supabase project or sends real customer email.
const { PGlite } = require(process.env.MZS_PGLITE_MODULE || '@electric-sql/pglite');
const fs = require('node:fs');
const assert = require('node:assert/strict');

(async () => {
  const db = new PGlite();
  const source = fs.readFileSync('supabase/plans/20261028_property_operations_phase1_review.sql','utf8');
  assert.match(source,/rollback;\s*-- DRY RUN ONLY/);
  assert.doesNotMatch(source,/\bgrant\s+(insert|update|delete)\b/i);
  await db.exec([
    'create role anon; create role authenticated; create role service_role;',
    'create schema auth;',
    "create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;",
    'grant usage on schema auth to authenticated;',
    'create table public.profiles (id uuid primary key,role text,is_active boolean);',
    "insert into public.profiles values ('11111111-1111-4111-8111-111111111111','admin',true),('11111111-1111-4111-8111-111111111112','client',true);",
    "create function public.is_admin() returns boolean language sql stable security definer set search_path='' as $$ select exists(select 1 from public.profiles where id=auth.uid() and role='admin' and is_active) $$;",
    'create table public.mzs_estate_properties(id uuid primary key);',
    'create table public.mzs_estate_units(id uuid primary key,property_id uuid);',
    'create table public.mzs_lease_issuers(id uuid primary key);',
    'create table public.mzs_lease_relationships(id uuid primary key);'
  ].join('\n'));
  const query = sql => db.query(sql);
  // The original plan is rollback-only even if somebody accidentally runs it.
  await db.exec(source);
  const none = (await query("select count(*)::int as n from information_schema.tables where table_schema='public' and table_name like 'mzs_ops_%'")).rows[0].n;
  assert.equal(none,0,'source file must leave all databases unchanged');

  // Test a COMMIT copy ONLY inside our ephemeral in-memory fixture.
  const simulated = source.replace(/rollback;\s*-- DRY RUN ONLY[^\n]*\s*$/i,'commit;');
  assert.notEqual(simulated,source);
  await db.exec(simulated);
  const tables=['mzs_ops_property_entity_links','mzs_ops_expense_documents',
    'mzs_ops_purchase_expenses','mzs_ops_expense_lines',
    'mzs_ops_expense_allocations','mzs_ops_expense_audit'];
  const rows=(await query("select relname,relrowsecurity from pg_class where relname like 'mzs_ops_%' and relkind='r' order by relname")).rows;
  for (const name of tables) {
    const hit=rows.find(r=>r.relname===name);
    assert.ok(hit,'missing table '+name);
    assert.equal(hit.relrowsecurity,true,'RLS must be enabled for '+name);
  }

  // Database permissions reject direct browser writes even for an admin.
  await db.exec("set role authenticated;select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',false);");
  assert.equal((await query('select count(*)::int as n from mzs_ops_purchase_expenses')).rows[0].n,0);
  await assert.rejects(db.exec("insert into mzs_ops_property_entity_links(property_id,legal_entity_id,relationship_type,effective_from) values('44444444-4444-4444-8444-444444444444','11111111-1111-4111-8111-111111111111','owner','2026-01-01')"),/permission denied/);
  await db.exec("select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111112',false);");
  assert.equal((await query('select count(*)::int as n from mzs_ops_expense_audit')).rows[0].n,0);
  await assert.rejects(db.exec("insert into mzs_ops_expense_lines(expense_id,line_number,category,description,net_cents,vat_cents,gross_cents) values ('11111111-1111-4111-8111-111111111111',1,'cleaning','Unauthorised',100,21,121)"),/permission denied/);

  await db.exec('reset role');
  console.log('Property Operations schema dry-run, RLS and direct-write denial tests passed');
  await db.close();
})().catch(err=>{console.error(err);process.exitCode=1;});
