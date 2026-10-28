import test from "node:test";import assert from "node:assert/strict";import {spawnSync} from "node:child_process";
test("Private evidence storage and approved supplier review transitions are role protected",()=>{
 const r=spawnSync(process.execPath,["tests/db/property-evidence-review-staging.cjs"],{encoding:"utf8",timeout:60000});
 assert.equal(r.status,0,r.stdout+"\n"+r.stderr);
});
