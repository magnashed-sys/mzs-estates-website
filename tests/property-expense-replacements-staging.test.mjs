import test from "node:test";import assert from "node:assert/strict";import {spawnSync} from "node:child_process";
test("Approved supplier correction requires a separately reviewed source and preserves both originals",()=>{
 const r=spawnSync(process.execPath,["tests/db/property-expense-replacements-staging.cjs"],{encoding:"utf8",timeout:60000});
 assert.equal(r.status,0,r.stdout+"\n"+r.stderr);
});
