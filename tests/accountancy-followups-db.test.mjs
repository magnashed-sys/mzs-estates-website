import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
test('accountancy follow-up delegation and atomic bulk database lifecycle',()=>{
 const r=spawnSync(process.execPath,['tests/db/accountancy-followups.cjs'],{encoding:'utf8',timeout:60000});assert.equal(r.status,0,r.stdout+'\n'+r.stderr);
});
