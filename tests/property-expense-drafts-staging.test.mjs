import test from "node:test";import assert from "node:assert/strict";import {spawnSync} from "node:child_process";
test("Staging purchase cost drafts reject unverified payer, mismatched allocation and unauthorized writes",()=>{
 const r=spawnSync(process.execPath,["tests/db/property-expense-drafts-staging.cjs"],{encoding:"utf8",timeout:60000});
 assert.equal(r.status,0,r.stdout+"\n"+r.stderr);
});
