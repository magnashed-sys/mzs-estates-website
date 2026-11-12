import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
test('notification aggregate enforces real PostgreSQL roles and preserves the private outbox',()=>{
 const r=spawnSync(process.execPath,['tests/db/action-center-notification.cjs'],{encoding:'utf8',timeout:60000});
 assert.equal(r.status,0,r.stdout+'\n'+r.stderr);
});
