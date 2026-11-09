import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('CRM register adds role and account-state filtering without changing authorization or client records',()=>{
 const page=read('app/admin/relationships/page.tsx');
 const register=read('app/admin/relationships/RelationshipRegister.tsx');
 const css=read('app/admin/relationships/crm-register.module.css');
 assert.match(page,/await requireEstateAdmin\(\)/);
 assert.match(page,/readRegister\(db, 'mzs_lease_relationships'\)/);
 assert.match(register,/const \[roleFilter,setRoleFilter\]=useState\('all'\)/);
 assert.match(register,/const \[accountFilter,setAccountFilter\]/);
 assert.match(register,/r\.roles\|\|\[\]\)\.includes\(roleFilter\)/);
 assert.match(register,/accountFilter==='linked'\?isLinked\(r\):!isLinked\(r\)/);
 assert.match(register,/accountFilter!=='unlinked'/);
 assert.match(register,/const crmCount=relationships\.length\+availableAccounts\.length/);
 assert.match(register,/const companyCount=relationships\.filter/);
 assert.match(register,/setSearch\(''\);setFilter\('all'\);setRoleFilter\('all'\);setAccountFilter\('all'\)/);
 assert.match(register,/href=\{'\/admin\/relationships\/overview\?relationship='\+r\.id\}/);
 assert.match(register,/href=\{'\/admin\/relationships\/invoices\/'\+r\.id\}/);
 assert.match(css,/\.summary\{display:grid/);
 assert.match(css,/max-width:560px/);
 assert.doesNotMatch(register,/deleteUser|updateUserById|saveRelationship\(\{.*roles.*\}\)/s);
});

test('sales invoice status shortcuts preserve validated report filters and do not record payments',()=>{
 const page=read('app/admin/workspaces/accountancy/sales/page.tsx');
 const style=read('app/admin/workspaces/accountancy/sales/sales.module.css');
 assert.match(page,/\['all','open','overdue','partial','unknown','paid'\]/);
 assert.match(page,/selectInvoices\(all,\{\.\.\.filters,status,page:1\},today\)\.totals\.count/);
 assert.match(page,/invoiceHref\(\{\.\.\.filters,status,page:1\},1\)/);
 assert.match(page,/aria-current=\{filters\.status===status\?'page':undefined\}/);
 assert.match(page,/Counts cover all records matching the selected year, entity, source and search/);
 assert.match(page,/i\.source==='external'&&i\.customerId/);
 assert.match(page,/href=\{'\/admin\/relationships\/overview\?relationship='\+i\.customerId\}/);
 assert.match(page,/loadInvoiceRegister\(db,filters\.year\)/);
 assert.match(style,/\.quickViews\{display:flex/);
 assert.match(style,/background:#ffffff/);
 assert.match(style,/\.table\{background:#ffffff/);
 assert.match(style,/\.table tbody tr:hover/);
});

test('purchase drafts distinguish verified archived originals without treating concepts as paid invoices',()=>{
 const page=read('app/admin/workspaces/estates/expenses/page.tsx');
 const css=read('app/admin/workspaces/estates/expenses/expenses.module.css');
 assert.match(page,/await requireEstateAdmin\(\)/);
 assert.match(page,/expensePageTotals\(drafts\.data\)/);
 assert.match(page,/archivedCostIds=new Set/);
 assert.match(page,/const archivedOnPage=drafts\.data\.filter\(d=>archivedCostIds\.has\(d\.id\)\)\.length/);
 assert.match(page,/const awaitingArchiveOnPage=drafts\.data\.length-archivedOnPage/);
 assert.match(page,/expenseOriginalStatus\(d,archivedCostIds\)/);
 assert.match(page,/href=\{attachmentHref\("cost",d\.id\)\}/);
 assert.match(page,/supplierNames\.has\(d\.supplier_relationship_id\)/);
 assert.match(page,/href=\{'\/admin\/relationships\/overview\?relationship='\+d\.supplier_relationship_id\}/);
 assert.match(css,/\.originalArchived/);
 assert.match(css,/\.originalPending/);
 assert.match(page,/Draft stage — no financial posting/);
});

test('management reports link only explicitly selected year/entity/property and separate drafts from issued sales',()=>{
 const page=read('app/admin/workspaces/estates/reports/page.tsx');
 const css=read('app/admin/workspaces/estates/reports/report-ux.module.css');
 assert.match(page,/requireEstateAdmin\(\)/);
 assert.match(page,/new URLSearchParams\(\{from:year\+'-01-01',until:year\+'-12-31'\}\)/);
 assert.match(page,/if\(entity\)purchaseParams\.set\('entity',entity\)/);
 assert.match(page,/if\(property\)purchaseParams\.set\('property',property\)/);
 assert.match(page,/if\(entity\)salesParams\.set\('entity',entity\)/);
 assert.doesNotMatch(page,/salesParams\.set\('property'/);
 assert.match(page,/report\.total\.net/);
 assert.match(page,/report\.total\.vat/);
 assert.match(page,/report\.total\.gross/);
 assert.match(page,/sales invoices and purchase drafts must not be subtracted to infer profit/);
 assert.match(page,/not posted costs or bank payments/);
 assert.match(css,/\.snapshot\{display:grid/);
 assert.match(css,/max-width:450px/);
});
