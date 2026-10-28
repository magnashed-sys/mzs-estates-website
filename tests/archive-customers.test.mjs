import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
test('Invoice-customer associations are scoped, source-preserving and admin-only in PostgreSQL',()=>{
 assert.match(execFileSync(process.execPath,['tests/db/archive-customers.cjs'],{encoding:'utf8'}),/checks passed/);
});
test('Customer lookup fails on partial results instead of silently presenting unlinked invoices',async()=>{
 const exports={};vm.runInNewContext(ts.transpileModule(readFileSync('lib/property-operations/archive-customers.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{exports});
 const fake=result=>({from(){return {select(){return {in:async()=>result}}}}});
 const row={invoice_id:'invoice',relationship_id:'customer',source_name:'Source',relationship_name:'Customer',linked_at:'2026-10-28'};
 assert.equal((await exports.archiveCustomers(fake({data:[row],count:1,error:null}),['invoice'])).get('invoice').relationship_id,'customer');
 await assert.rejects(exports.archiveCustomers(fake({data:[row],count:2,error:null}),['invoice']));
 await assert.rejects(exports.archiveCustomers(fake({data:null,count:null,error:{}}),['invoice']));
 await assert.rejects(exports.archiveCustomers(fake({data:[row,row],count:2,error:null}),['invoice']));
});
