import test from 'node:test';import assert from 'node:assert/strict';import {spawnSync} from 'node:child_process';
test('staging legal property attribution migration is admin-only and audited',()=>{
 const r=spawnSync(process.execPath,['tests/db/property-entity-links-staging.cjs'],{encoding:'utf8',timeout:60000});
 assert.equal(r.status,0,r.stdout+'\n'+r.stderr);
});
