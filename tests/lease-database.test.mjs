import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
test('lease database lifecycle, recurring calculations and access controls',()=>{
 const result=spawnSync(process.execPath,['tests/db/lease-contracts.cjs'],{encoding:'utf8',timeout:60000});
 assert.equal(result.status,0,result.stdout+'\n'+result.stderr);
});
