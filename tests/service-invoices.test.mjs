import test from 'node:test';import assert from 'node:assert/strict';import {spawnSync} from 'node:child_process';
test('standalone invoice lifecycle uses immutable snapshots, exact cents, shared numbers and protected receipts',()=>{const r=spawnSync(process.execPath,['tests/db/service-invoices.cjs'],{encoding:'utf8',timeout:120000});assert.equal(r.status,0,r.stdout+'\n'+r.stderr);});
