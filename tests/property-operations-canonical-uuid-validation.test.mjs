import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import vm from "node:vm";

const sources=[
 "app/admin/workspaces/estates/staff/actions.ts",
 "app/admin/workspaces/estates/staff/review-actions.ts",
 "app/admin/workspaces/estates/staff/completion-actions.ts",
 "app/staff/actions.ts",
 "app/staff/correction-actions.ts",
 "app/api/staff/maintenance-photo/route.ts",
 "app/api/staff/maintenance-photo/[id]/route.ts",
 "app/admin/workspaces/estates/expenses/entity-link-actions.ts",
 "app/admin/workspaces/estates/expenses/expense-draft-actions.ts",
 "app/admin/workspaces/estates/expenses/evidence-review-actions.ts",
 "app/admin/workspaces/estates/expenses/correction-actions.ts",
 "app/admin/workspaces/estates/expenses/correction-decision-actions.ts",
 "app/admin/workspaces/estates/expenses/replacement-actions.ts",
 "app/admin/workspaces/estates/expenses/documents/route.ts",
 "app/admin/workspaces/estates/expenses/documents/[id]/route.ts",
 "app/admin/workspaces/estates/expenses/accountant-export/route.ts",
 "app/admin/workspaces/estates/expenses/sales-export/route.ts",
 "app/admin/workspaces/estates/expenses/accountant-bundle/route.ts",
 "app/api/admin/property-operations-costs/route.ts"
];
test("Every staff, supplier document, finance and export route accepts canonical UUIDs",()=>{
 const validIds=[
  "831c325a-419a-4c6b-a38f-93571b0fa901",
  "24e871ba-65b2-43c4-b03a-3e24a4ecc125"
 ];
 const invalidIds=[
  "831c325a-419a-4c6b-93571b0fa901",
  "",
  "00000000-0000-0000-0000",
  "../../a-private-file"
 ];
 for(const path of sources){
  const source=readFileSync(new URL("../"+path,import.meta.url),"utf8");
  const regex=source.match(/const uuid=(\/\^[^\n;]+\/i);/);
  assert.ok(regex,"missing UUID validator: "+path);
  const validator=vm.runInNewContext(regex[1]);
  for(const uuid of validIds)assert.ok(validator.test(uuid),path+" rejected canonical UUID "+uuid);
  for(const uuid of invalidIds)assert.equal(validator.test(uuid),false,path+" accepted malformed UUID "+uuid);
 }
});
