import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
test('lease pricing and future invoice amounts use authenticated, audited PostgreSQL workflow',()=>{
 const r=spawnSync(process.execPath,['tests/db/lease-pricing.cjs'],{encoding:'utf8',timeout:90000,maxBuffer:2*1024*1024});
 assert.equal(r.status,0,r.stdout+r.stderr);
});
