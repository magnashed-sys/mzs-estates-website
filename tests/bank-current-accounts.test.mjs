import test from 'node:test';
import {execFileSync} from 'node:child_process';
test('bank and current-account database invariants',{timeout:60000},()=>{execFileSync(process.execPath,['tests/db/bank-current-accounts.cjs'],{stdio:'pipe'});});
