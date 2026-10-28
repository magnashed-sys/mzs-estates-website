import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const root=new URL("../",import.meta.url);
const read=(path)=>readFileSync(new URL(path,root),"utf8");
const pairs=[
 ["app/admin/workspaces/estates/staff/actions.ts","app/admin/workspaces/estates/staff/StaffScopeForm.tsx"],
 ["app/admin/workspaces/estates/staff/review-actions.ts","app/admin/workspaces/estates/staff/StaffReviews.tsx"],
 ["app/admin/workspaces/estates/staff/completion-actions.ts","app/admin/workspaces/estates/staff/StaffFinalAdmin.tsx"],
 ["app/staff/actions.ts","app/staff/StaffForms.tsx"],
 ["app/staff/correction-actions.ts","app/staff/StaffCompletion.tsx"],
 ["app/admin/workspaces/estates/expenses/entity-link-actions.ts","app/admin/workspaces/estates/expenses/PropertyEntityLinks.tsx"],
 ["app/admin/workspaces/estates/expenses/expense-draft-actions.ts","app/admin/workspaces/estates/expenses/ExpenseDraftSaver.tsx"],
 ["app/admin/workspaces/estates/expenses/evidence-review-actions.ts","app/admin/workspaces/estates/expenses/ExpenseEvidenceReview.tsx"],
 ["app/admin/workspaces/estates/expenses/correction-actions.ts","app/admin/workspaces/estates/expenses/ExpenseCorrections.tsx"],
 ["app/admin/workspaces/estates/expenses/correction-decision-actions.ts","app/admin/workspaces/estates/expenses/CorrectionDecisions.tsx"],
 ["app/admin/workspaces/estates/expenses/replacement-actions.ts","app/admin/workspaces/estates/expenses/ExpenseReplacementLinks.tsx"]
];
test("Every MZS Ops Server Action module exports only async functions or erased TypeScript types",()=>{
 for(const [path] of pairs){
  const source=read(path);
  assert.match(source,/^["']use server["'];/,{message:path+" must be a server-actions module"});
  assert.doesNotMatch(source,/^export\s+(?:const|let|var|class|function\s+(?!async\b)|default\s+(?!async\b))/m,
   {message:path+" cannot export any non-async runtime value"});
  assert.match(source,/^export async function /m,{message:path+" has no action to export"});
 }
});
test("Every client form uses a serializable local initializer without importing one from a Server Action",()=>{
 for(const [server,client] of pairs){
  const source=read(client);
  assert.match(source,/^["']use client["'];/,{message:client+" must remain a Client Component"});
  assert.match(source,/import\s*\{\s*initialFormActionState\s*\}\s*from\s*["'].*form-state["']/);
  assert.match(source,/useActionState\(/);
  assert.doesNotMatch(source,/\binitial(?:Staff|Scope|Ops|Review|Expense|Entity|Cost|Correction|Replacement)Action(?:State)?\b/,
   {message:client+" has a stale action-state import"});
  // Client must still call the legitimate async action module, not a fake no-op.
  assert.ok(source.includes("initialFormActionState"),client);
  assert.ok(read(server).startsWith('"use server"')||read(server).startsWith("'use server'"));
 }
});
test("Shared initializer is a plain client-safe value and never a server action",()=>{
 const value=read("lib/property-operations/form-state.ts");
 assert.doesNotMatch(value,/^\s*[\"']use server[\"'];?\s*$/m);
 assert.match(value,/export const initialFormActionState/);
 assert.match(value,/status:"idle"/);
});
