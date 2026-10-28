import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
test('Property Operations review schema stays unapplied and all proposed tables deny browser writes',()=>{
  const result=spawnSync(process.execPath,['tests/db/property-operations-review.cjs'],{
    encoding:'utf8',timeout:60000
  });
  assert.equal(result.status,0,result.stdout+'\n'+result.stderr);
});
