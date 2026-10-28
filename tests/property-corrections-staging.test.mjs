import test from 'node:test';import assert from 'node:assert/strict';import {spawnSync} from 'node:child_process';
test('Reviewed supplier corrections preserve originals and deny cross-role writes',()=>{
 const r=spawnSync(process.execPath,['tests/db/property-corrections-staging.cjs'],{encoding:'utf8',timeout:60000});
 assert.equal(r.status,0,r.stdout+'\n'+r.stderr);
});
