import test from "node:test";import assert from "node:assert/strict";import {spawnSync} from "node:child_process";
test("Final Staff & Maintenance operational and scoped security integration",()=>{
 const r=spawnSync(process.execPath,["tests/db/property-staff-final-completion.cjs"],{encoding:"utf8",timeout:60000});
 assert.equal(r.status,0,r.stdout+"\n"+r.stderr);
});
