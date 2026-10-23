import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const exports = {};
vm.runInNewContext(ts.transpileModule(readFileSync(new URL('../app/admin/admin-model.ts', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText, { exports });
const booking = (id, check_in, extra = {}) => ({ id, check_in, check_out: '2027-12-31', project_id: 'test', is_test: false, status: 'confirmed', ...extra });
test('three-month arrivals include today, exclude past/end boundary and omit test or unconfirmed stays', () => {
  const data = [
    booking('later', '2027-01-22'), booking('end', '2027-01-23'),
    booking('today', '2026-10-23'), booking('past', '2026-10-22'),
    booking('test', '2026-12-01', { is_test: true }),
    booking('cancelled', '2026-12-01', { status: 'cancelled' }),
    booking('requested', '2026-12-01', { status: 'requested' }),
  ];
  assert.equal(exports.liveArrivals(data, '2026-10-23').map(b => b.id).join(','), 'today,later');
});
test('calendar month boundaries clamp to February in common and leap years', () => {
  for (const [today, inside, outside] of [
    ['2026-11-30', '2027-02-27', '2027-02-28'],
    ['2023-11-30', '2024-02-28', '2024-02-29'],
  ]) {
    assert.equal(exports.liveArrivals([booking('inside', inside), booking('outside', outside)], today).map(b => b.id).join(','), 'inside');
  }
});
