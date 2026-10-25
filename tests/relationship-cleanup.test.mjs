import test from 'node:test';import assert from 'node:assert/strict';import {spawnSync} from 'node:child_process';
test('relationship address and deletion lifecycle enforces database boundaries',()=>{const r=spawnSync(process.execPath,['tests/db/relationship-cleanup.cjs'],{encoding:'utf8',timeout:60000});assert.equal(r.status,0,r.stdout+'\n'+r.stderr);});
