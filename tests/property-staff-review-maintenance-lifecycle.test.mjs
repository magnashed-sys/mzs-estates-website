import test from "node:test";import assert from "node:assert/strict";import {spawnSync} from "node:child_process";
test("Staff review and maintenance lifecycle isolate actors and preserve actual minutes",()=>{
 const x=spawnSync(process.execPath,["tests/db/property-staff-review-maintenance-lifecycle.cjs"],{encoding:"utf8",timeout:60000});
 assert.equal(x.status,0,x.stdout+"\n"+x.stderr);
});
