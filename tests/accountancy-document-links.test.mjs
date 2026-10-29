import test from 'node:test';import assert from 'node:assert/strict';import {spawnSync} from 'node:child_process';
test('dossier PDF links enforce scope, retain originals and record corrections in PostgreSQL',()=>{const r=spawnSync(process.execPath,['tests/db/accountancy-document-links.cjs'],{encoding:'utf8',timeout:120000});assert.equal(r.status,0,r.stdout+'\n'+r.stderr);});
