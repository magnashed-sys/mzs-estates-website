import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const source=p=>readFileSync(p,'utf8');

test('Zorgbalans is a scoped work area, not a property',()=>{
 const sql=source('supabase/migrations/20261030104500_zorgbalans_staff_time_private_billing.sql');
 assert.ok(sql.includes("('zorgbalans','Zorgbalans')"));
 assert.ok(sql.includes('mzs_ops_staff_area_scopes'));
 assert.ok(!sql.includes('insert into public.mzs_estate_properties'));
 assert.ok(source('app/staff/actions.ts').includes("'private-magdy','zorgbalans'"));
});
test('approved visits are rounded individually, with correct VAT and a historical cutoff',()=>{
 const sql=source('supabase/migrations/20261030104500_zorgbalans_staff_time_private_billing.sql');
 assert.ok(sql.includes("(v.effective_minutes+59)/60"));
 assert.ok(sql.includes('invoiced_hours*2500'));
 assert.ok(sql.includes('v_net*21.0/100'));
 assert.ok(sql.includes("date '2026-10-26'"));
 const hours=[25,73].map(minutes=>Math.max(1,Math.ceil(minutes/60)));
 assert.deepEqual(hours,[1,2]);assert.equal(hours.reduce((a,b)=>a+b,0)*2500,7500);
 assert.equal(Math.round(7500*.21),1575);
});
test('each approved visit has exactly one admin-only private billing link',()=>{
 const sql=source('supabase/migrations/20261030104500_zorgbalans_staff_time_private_billing.sql');
 assert.ok(sql.includes('visit_id uuid not null unique'));
 assert.ok(sql.includes("v.review_decision='approved'"));
 assert.ok(sql.includes('v.correction_pending=false'));
 assert.ok(sql.includes('security_invoker=true'));
 assert.ok(sql.includes('public.is_admin()'));
 assert.ok(sql.includes('mzs_ops_prepare_zorgbalans_invoice'));
 assert.ok(sql.includes('mzs_ops_confirm_zorgbalans_invoice'));
});
test('invoice PDF uses the private issuer, provides specification and does not send mail',()=>{
 const pdf=source('app/api/admin/zorgbalans/invoices/[id]/pdf/route.ts');
 assert.ok(pdf.includes('requireEstateAdmin()'));
 assert.ok(pdf.includes('CONCEPTFACTUUR'));
 assert.ok(pdf.includes('URENSPECIFICATIE'));
 assert.ok(pdf.includes('issuer.iban'));
 assert.ok(pdf.includes('Content-Disposition'));
 assert.ok(!pdf.includes('SCHOONMAAK EN DIENSTVERLENING'));
 assert.ok(!pdf.includes('MZS GROUP'));
 assert.ok(!pdf.includes('nodemailer'));
});
