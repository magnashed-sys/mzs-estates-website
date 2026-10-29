import test from 'node:test';import assert from 'node:assert/strict';import {spawnSync} from 'node:child_process';
test('imported invoice SQL protects opening balances, receipts and audit history',()=>{const r=spawnSync(process.execPath,['tests/db/archive-invoice-receipts.cjs'],{encoding:'utf8',timeout:120000});assert.equal(r.status,0,r.stdout+'\n'+r.stderr);});
