import test from 'node:test';import assert from 'node:assert/strict';import {spawnSync} from 'node:child_process';
test('Scoped employee visits and maintenance tickets deny unassigned clients',()=>{
 const r=spawnSync(process.execPath,['tests/db/property-staff-maintenance-staging.cjs'],{encoding:'utf8',timeout:60000});
 assert.equal(r.status,0,r.stdout+'\n'+r.stderr);
});
