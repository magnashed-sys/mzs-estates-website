import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
const page=read("app/admin/workspaces/estates/expenses/page.tsx");
const action=read("app/admin/workspaces/estates/expenses/expense-draft-actions.ts");
const form=read("app/admin/workspaces/estates/expenses/ExpenseDraftSaver.tsx");
const calculator=read("app/admin/workspaces/estates/expenses/ExpenseCalculator.tsx");
const nav=read("app/admin/workspaces/estates/page.tsx");

test("Admin expense route only reads isolated registers and rejects wrong environment",()=>{
 assert.match(page,/VERCEL_ENV==="production"/);
 assert.match(page,/NEXT_PUBLIC_SUPABASE_URL==="https:\/\/ptrnjzmcehrhbsfxntgw.supabase.co"/);
 assert.match(page,/VERCEL_ENV==="preview"/);
 assert.match(page,/await requireEstateAdmin\(\)/);
 assert.match(page,/mzs_ops_property_entity_links/);
 assert.match(page,/mzs_ops_expense_drafts/);
 assert.match(page,/x\.data\.length!==x\.count/);
 assert.match(page,/\.limit\(200\)/);
 assert.doesNotMatch(page,/service_role|supabase\.auth\.admin|\.update\(|\.delete\(/);
});
test("Draft save remains an explicit, immutable, authenticated administrative action",()=>{
 assert.match(action,/^"use server"/);
 assert.match(action,/confirmed_real_draft/);
 assert.match(action,/await requireEstateAdmin\(\)/);
 assert.match(action,/db\.from\("mzs_ops_expense_drafts"\)\.insert/);
 assert.match(action,/propertyId=requiredUuid/);
 assert.match(action,/entityId=requiredUuid/);
 assert.match(action,/supplier_relationship_id/);
 assert.match(action,/\.reduce\(\(sum,a\)=>sum\+a\.net_cents/);
 assert.match(action,/error\?\.code==="23505"/);
 assert.doesNotMatch(action,/sendMail|SMTP|service_role|mzs_lease_invoices|mzs_capital_payments|\.delete\(|\.update\(/);
 assert.match(form,/name="confirmed_real_draft" value="yes" required/);
 assert.match(form,/payerLinks\.some/);
 assert.match(form,/effective_from<=selection\.invoiceDate/);
 assert.match(form,/disabled=\{!canSave\}/);
});
test("Calculator supports exact-cents unit allocation but not tax or invoices",()=>{
 assert.match(calculator,/expenseAllocationPreview\(/);
 assert.match(calculator,/inputEuroCents\(/);
 assert.match(calculator,/equal-units/);
 assert.match(calculator,/Kostendrager geverifieerd voor deze factuurdatum/);
 assert.match(calculator,/geen/i);
 assert.match(nav,/href="\/admin\/workspaces\/estates\/expenses"/);
 assert.doesNotMatch(calculator,/\.insert\(|\.update\(|\.delete\(|sendMail/);
});
