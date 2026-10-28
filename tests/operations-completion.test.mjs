import test from 'node:test';import assert from 'node:assert/strict';import {spawnSync} from 'node:child_process';
test('work orders, photo storage and export snapshot enforce PostgreSQL access and lifecycle rules',()=>{
 const run=spawnSync(process.execPath,['tests/db/operations-completion.cjs'],{encoding:'utf8',timeout:120000});assert.equal(run.status,0,run.stdout+'\n'+run.stderr);
});
