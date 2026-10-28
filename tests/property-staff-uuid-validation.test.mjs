import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import vm from "node:vm";
const paths=[
 "app/admin/workspaces/estates/staff/actions.ts",
 "app/admin/workspaces/estates/staff/review-actions.ts",
 "app/admin/workspaces/estates/staff/completion-actions.ts",
 "app/staff/actions.ts",
 "app/staff/correction-actions.ts",
 "app/api/staff/maintenance-photo/[id]/route.ts"
];
test("All property staff actions accept real 36-character user, property and visit UUIDs",()=>{
 const valid="24e871ba-65b2-43c4-b03a-3e24a4ecc125";
 const second="a470d946-8ab0-41c7-bcfa-98547441386a";
 const bad="24e871ba-65b2-43c4-3e24a4ecc125";
 for(const path of paths){
  const source=readFileSync(new URL("../"+path,import.meta.url),"utf8");
  const match=source.match(/const uuid=(\/\^[^\n;]+\/i);/);
  assert.ok(match,"No UUID validator in "+path);
  const regex=vm.runInNewContext(match[1]);
  assert.ok(regex.test(valid),path+" rejects a valid account/property UUID");
  assert.ok(regex.test(second),path+" rejects a valid staff visit ID");
  assert.ok(!regex.test(bad),path+" accepts malformed 4-component IDs");
  assert.ok(!regex.test(""),path+" accepts empty ID");
 }
});
test("Member assignment must check both member ID and physical property ID",()=>{
 const src=readFileSync(new URL("../app/admin/workspaces/estates/staff/actions.ts",import.meta.url),"utf8");
 assert.match(src,/uuid\.test\(profileId\)/);
 assert.match(src,/uuid\.test\(propertyId\)/);
 assert.match(src,/mzs_ops_staff_scope_events/);
});
