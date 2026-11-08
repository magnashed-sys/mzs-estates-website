import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');

test('Owner Stays shares the light admin palette and preserves the global dark header', () => {
  const page = read('app/admin/owner-stays/page.tsx');
  const decision = read('app/admin/owner-stays/OwnerStayDecision.tsx');
  const cleanup = read('app/admin/owner-stays/OwnerStayCleanup.tsx');
  const layout = read('app/admin/layout.tsx');
  assert.match(layout, /<AdminHeader\/><div className="admin-light-content">/);
  assert.match(page, /background:'#f5f5f0',color:'#243f35'/);
  assert.match(page, /background:'#ffffff'/);
  assert.match(page, /border:'1px solid #dce3d9'/);
  assert.match(page, /background:'#28543f'/);
  assert.match(decision, /background:"#28543f"/);
  assert.match(cleanup, /background:"#fff"/);
  for (const [name,source] of [['Owner Stays',page],['Approval',decision],['Cleanup',cleanup]]) {
    for (const old of ['#0f0f0e','#151411','#24221f','#d5c09a','#b9aa94','#655c4c']) {
      assert.ok(!source.includes(old), name+' still contains dark theme token '+old);
    }
  }
});

test('Booking navigation is scoped to reservations and Owner Stays, not property, contracts or test cleanup links', () => {
  const index = read('app/admin/bookings/page.tsx');
  const ops = read('app/admin/bookings/operations/page.tsx');
  const legacy = read('app/admin/unified-bookings/page.tsx');
  assert.match(index, /href="\/admin\/bookings\/operations"/);
  assert.match(index, /href="\/admin\/owner-stays"/);
  for (const source of [index, ops, legacy]) {
    assert.doesNotMatch(source, /<Link[^>]+href="\/admin\/group\/estates\/contracts\?view=invoices"/);
    assert.doesNotMatch(source, /<Link[^>]+href="\/admin\/group\/estates\/properties"/);
    assert.doesNotMatch(source, /<Link[^>]+href="\/admin\/bookings\/operations\?scope=test"/);
  }
  assert.match(ops, /href="\/admin\/bookings\/operations\?view=calendar"/);
  assert.match(ops, /href="\/admin\/bookings\/operations\?view=cancellations"/);
  // The admin-only test scope is retained for restricted maintenance URLs.
  assert.match(ops, /params\.scope==="test"/);
});

test('Partner grants, availability conflict checks, owner approvals and booking price auditing remain intact', () => {
  const page = read('app/admin/owner-stays/page.tsx');
  const ops = read('app/admin/bookings/operations/page.tsx');
  assert.match(page, /requireEstateAdmin\(\)/);
  assert.match(page, /grantPartner/);
  assert.match(page, /adjustBookingPrice/);
  assert.match(page, /conflictByInterval/);
  assert.match(page, /<OwnerStayDecision id=\{r\.id\} blocked=\{blocked\}\/>/);
  assert.match(page, /<OwnerStayCleanup id=\{r\.id\}/);
  assert.match(ops, /<BookingManagement/);
  assert.match(read('app/admin/bookings/page.tsx'), /name="status"/);
});
