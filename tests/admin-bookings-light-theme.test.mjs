import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const bookingFiles = [
  'app/admin/bookings/page.tsx',
  'app/admin/bookings/operations/page.tsx',
  'app/admin/unified-bookings/page.tsx',
  'app/admin/unified-bookings/[id]/page.tsx',
  'app/admin/unified-bookings/BookingRegister.tsx',
  'app/admin/unified-bookings/BookingEditor.tsx',
  'app/admin/BookingManagement.tsx',
  'app/admin/RentalNotificationStatus.tsx',
];
const text = path => readFileSync(path, 'utf8');

test('both booking overviews and the full booking dossier render a light canvas', () => {
  for(const file of [
    'app/admin/bookings/page.tsx',
    'app/admin/bookings/operations/page.tsx',
    'app/admin/unified-bookings/page.tsx',
    'app/admin/unified-bookings/[id]/page.tsx'
  ]) {
    const source = text(file);
    assert.match(source, /return <main style=\{\{[^}]*background:\s*["']#f5f5f0["']/,
      'light booking page root missing in '+file);
    assert.match(source, /color:\s*["']#243f35["']/,
      'dark green booking text missing in '+file);
  }
});

test('booking filters, panels, borders and links do not use the old dark palette', () => {
  const oldDarkTokens = ['#0d0d0c','#151411','#12110f','#181410','#171612','#1d1b16',
    '#eee8dd','#eeeae2','#f0e9de','#d5c09a','#514839'];
  for(const file of bookingFiles) {
    const source=text(file);
    for(const token of oldDarkTokens) assert.ok(!source.includes(token), file+' still contains '+token);
  }
  const main=text('app/admin/bookings/page.tsx');
  assert.match(main, /const style=\{background:"#ffffff",border:"1px solid #dce3d9"/);
  assert.match(main, /const control=\{[^}]*background:"#ffffff"/);
  assert.match(main, /const linkStyle=\{color:"#28543f"/);
});

test('booking functionality and access guards remain in place', () => {
  const main=text('app/admin/bookings/page.tsx');
  const details=text('app/admin/unified-bookings/[id]/page.tsx');
  const operations=text('app/admin/bookings/operations/page.tsx');
  const register=text('app/admin/unified-bookings/BookingRegister.tsx');
  assert.match(main,/requireEstateAdmin\(\)/);
  assert.match(main,/mzs_admin_bookings_search_v2/);
  assert.match(main,/name="archive"/);
  assert.match(main,/name="status"/);
  assert.match(details,/requireEstateAdmin\(\)/);
  assert.match(operations,/requireEstateAdmin\(\)/);
  assert.match(operations,/<BookingManagement/);
  assert.match(register,/setQuery/);
  assert.match(register,/setStatus/);
  assert.match(register,/setTime/);
});

test('the existing shared header stays out of the light booking content', () => {
  const layout=text('app/admin/layout.tsx');
  assert.match(layout, /<AdminHeader\/><div className="admin-light-content">/);
  const header=text('app/admin/AdminHeader.module.css');
  assert.match(header,/\.shell\{background:#0c0b09/);
});

test('booking text and links meet WCAG AA contrast on white surfaces', () => {
  function lum(hex) {
    const rgb=hex.match(/\w\w/g).map(v=>parseInt(v,16)/255)
      .map(v=>v<=0.04045?v/12.92:Math.pow((v+0.055)/1.055,2.4));
    return rgb[0]*0.2126+rgb[1]*0.7152+rgb[2]*0.0722;
  }
  const ratio=(a,b)=>(Math.max(lum(a),lum(b))+0.05)/(Math.min(lum(a),lum(b))+0.05);
  assert.ok(ratio('243f35','ffffff')>=7);
  assert.ok(ratio('28543f','ffffff')>=7);
  assert.ok(ratio('5d7064','ffffff')>=4.5);
});
