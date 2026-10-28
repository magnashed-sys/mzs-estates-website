import test from "node:test";import assert from "node:assert/strict";import {spawnSync} from "node:child_process";
test("Correction decisions cannot be changed after a validated administrator decision",()=>{
 const r=spawnSync(process.execPath,["tests/db/property-correction-decisions-staging.cjs"],{encoding:"utf8",timeout:60000});
 assert.equal(r.status,0,r.stdout+"\n"+r.stderr);
});
