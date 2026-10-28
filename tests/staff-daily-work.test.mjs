import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
test('daily staff and maintenance workflows enforce access and immutable revisions in PostgreSQL',()=>{
 const run=spawnSync(process.execPath,['tests/db/staff-daily-work.cjs'],{encoding:'utf8',timeout:120000});
 assert.equal(run.status,0,run.stdout+'\n'+run.stderr);
});
