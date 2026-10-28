import test from "node:test";import assert from "node:assert/strict";import {readFileSync} from "node:fs";
const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
test("Staging-only navigation and money panel are not displayed in Production",()=>{
 const estates=read("app/admin/workspaces/estates/page.tsx");
 const finance=read("app/admin/FinancialCockpit.tsx");
 assert.match(estates,/operationsStaging/);
 assert.match(estates,/process\.env\.VERCEL_ENV==="preview"/);
 assert.match(estates,/operationsStaging&&\(/);
 assert.match(estates,/\/admin\/workspaces\/estates\/staff/);
 assert.match(estates,/\/admin\/workspaces\/estates\/expenses/);
 assert.match(finance,/NEXT_PUBLIC_SUPABASE_URL/);
 assert.match(finance,/PropertyOperationsFinancialPanel/);
});
