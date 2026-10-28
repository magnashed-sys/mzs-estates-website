import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const code = ts.transpileModule(readFileSync(new URL('../lib/property-operations/finance.ts', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const subject = {};
vm.runInNewContext(code, { exports: subject });
const { roundedBillableMinutes, hourlyChargeCents, invoiceTotalsFromNetCents,
  allocateCostCents, accountantCsv } = subject;

test('the Zorgbalans pilot bills whole hours per visit, with a one-hour minimum', () => {
  const rule = { minimumMinutes: 60, incrementMinutes: 60 };
  for (const [actual, billed] of [[1, 60], [30, 60], [45, 60], [60, 60], [61, 120], [90, 120]]) {
    assert.equal(roundedBillableMinutes(actual, rule), billed);
  }
  assert.equal(hourlyChargeCents(60, 2500), 2500);
  assert.equal(hourlyChargeCents(120, 2500), 5000);
  assert.equal(roundedBillableMinutes(30, rule) + roundedBillableMinutes(30, rule), 120,
    'two visits are not one 60-minute weekly total');
});

test('non-positive, fractional and unreasonable durations are denied', () => {
  const r = { minimumMinutes: 60, incrementMinutes: 60 };
  for (const minutes of [0, -1, 1.5, NaN, 1000000]) {
    assert.throws(() => roundedBillableMinutes(minutes, r));
  }
  for (const bad of [{ minimumMinutes: -1, incrementMinutes: 60 },
    { minimumMinutes: 60, incrementMinutes: 0 },
    { minimumMinutes: 60, incrementMinutes: .5 }]) {
    assert.throws(() => roundedBillableMinutes(45, bad));
  }
  assert.throws(() => hourlyChargeCents(60, 0.5));
});

test('only reviewed explicit VAT rates are used; 650 EUR + 21% equals 786.50 EUR', () => {
  assert.deepEqual(JSON.parse(JSON.stringify(invoiceTotalsFromNetCents(65000, 2100))),
    { netCents: 65000, vatCents: 13650, grossCents: 78650 });
  assert.equal(invoiceTotalsFromNetCents(5, 1000).vatCents, 1, 'positive half cent rounds up');
  assert.equal(invoiceTotalsFromNetCents(500, 0).grossCents, 500);
  assert.throws(() => invoiceTotalsFromNetCents(0.1, 2100));
  assert.throws(() => invoiceTotalsFromNetCents(100, -1));
});

test('one cost is split among units without multiplying or losing cents', () => {
  const shares = [{ reference: 'unit-c', basisPoints: 3333 },
    { reference: 'unit-b', basisPoints: 3333 },
    { reference: 'unit-a', basisPoints: 3334 }];
  const result = allocateCostCents(10001, shares);
  assert.equal(result.reduce((sum, x) => sum + x.amountCents, 0), 10001);
  assert.equal(result.find(x => x.reference === 'unit-a').amountCents, 3335);
  const reversed = allocateCostCents(10001, shares.slice().reverse());
  assert.deepEqual(Object.fromEntries(result.map(x => [x.reference, x.amountCents])),
    Object.fromEntries(reversed.map(x => [x.reference, x.amountCents])));
  assert.deepEqual(JSON.parse(JSON.stringify(allocateCostCents(0, [{ reference: 'property', basisPoints: 10000 }]))),
    [{ reference: 'property', amountCents: 0 }]);
});

test('invalid allocations are rejected instead of silently assigning costs', () => {
  assert.throws(() => allocateCostCents(100, [{ reference: 'unit', basisPoints: 5000 }]));
  assert.throws(() => allocateCostCents(100, [{ reference: 'unit', basisPoints: 5000 }, { reference: 'unit', basisPoints: 5000 }]));
  assert.throws(() => allocateCostCents(100.5, [{ reference: 'unit', basisPoints: 10000 }]));
  assert.throws(() => allocateCostCents(100, []));
});

test('export quotes CSV fields, rejects missing data and neutralises spreadsheet formulas', () => {
  const csv = accountantCsv(['reference', 'amount', 'memo'], [
    { reference: '=1+1', amount: -100, memo: 'Gas, water and "electricity"' },
    { reference: '@SUM(A1)', amount: 25.5, memo: 'normal' },
  ]);
  assert.ok(csv.startsWith('\uFEFF'));
  assert.match(csv, /"'=1\+1","-100","Gas, water and ""electricity"""/);
  assert.match(csv, /"'@SUM\(A1\)"/);
  assert.throws(() => accountantCsv(['a'], [{}]));
  assert.throws(() => accountantCsv(['a'], [{ a: {} }]));
});
