import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const component=read('app/admin/FinancialCockpit.tsx');
const css=read('app/admin/FinancialCockpit.module.css');

test('Financial Cockpit uses light surfaces without modifying the shared dark header',()=>{
  for(const surface of ['.cockpit','.metric','.chartPanel','.detailPanel','.netStrip>div','.reportTable','.periodCard']){
    assert.ok(css.includes(surface),surface+' missing');
  }
  assert.match(css,/\.cockpit\{background:#f5f5f0;border-color:#dce3d9;color:#243f35/);
  assert.match(css,/background:#ffffff;border:1px solid #dce3d9/);
  assert.match(css,/\.tableScroll thead th\{background:#edf1e9/);
  assert.match(css,/\.barRent\{background:#28543f\}/);
  assert.match(css,/@media\(max-width:560px\)/);
  assert.match(css,/prefers-reduced-motion/);
  assert.match(read('app/admin/layout.tsx'),/<AdminHeader\/><div className="admin-light-content">/);
});

test('Selected-month forecast and recorded receipts are labelled separately from balances as of today',()=>{
  assert.match(component,/view==='overview'&&<section className=\{s\.periodSnapshot\}/);
  assert.match(component,/selected\?\.rentForecast\?\?0/);
  assert.match(component,/selected\?\.rentReceived\?\?0/);
  assert.match(component,/data\.report\.outstandingRent/);
  assert.match(component,/data\.report\.overdueRent/);
  assert.match(component,/The selected month applies only to the first two cards/);
  assert.match(component,/Payments recorded/gi.test(component) ? /recorded payments/ : /not bank-verified/i);
  assert.match(component,/not bank-verified/);
});

test('Existing entity filtering, monthly forecasts, receipts, balances and exports are preserved',()=>{
  assert.match(component,/setEntity\(e\.target\.value\)/);
  assert.match(component,/setMonth\(Number\(e\.target\.value\)\)/);
  assert.match(component,/setYear\(Number\(e\.target\.value\)\)/);
  assert.match(component,/fetch\('\/api\/admin\/financial-cockpit\?year='/);
  assert.match(component,/entity=\x27\+encodeURIComponent\(entity\)/);
  assert.match(component,/loadedDetail!=='full'/);
  assert.match(component,/exportCsv/);
  assert.match(component,/currentInvoices/);
  assert.match(component,/data\.report\.recordedNet/);
  assert.match(component,/\/admin\/group\/estates\/contracts\?view=units/);
  assert.match(component,/\/admin\/group\/estates\/properties/);
  assert.match(component,/\/admin\/workspaces\/accountancy\/sales/);
});

test('Financial dashboard does not invent a per-property accounting breakdown or mutate finance records',()=>{
  const route=read('app/api/admin/financial-cockpit/route.ts');
  assert.match(route,/requireContractAdminApi\(\)/);
  assert.match(route,/cache-control/i.test(route)?/Cache-Control/ : /Cache-Control/);
  assert.match(route,/no-store/);
  assert.match(route,/readRegister\(db,'mzs_lease_contracts'\)/);
  assert.doesNotMatch(component,/from\(['"]mzs_lease_.*['"]\)\.insert/);
});
