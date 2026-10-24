import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import vm from 'node:vm';

const source=ts.transpileModule(readFileSync('lib/estates/lease-month.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
const api={};vm.runInNewContext(source,{exports:api});
const subject='Huur {unitadres} — {maand} {jaar}';

test('partial, cleared and invalid invoice months never reach date formatting',()=>{
 for(const period of ['', '2', '20', '2026', '2026-', '2026-1', '2026-00', '2026-13', '11/2026', '2026-11-01', '0000-01', '10000-01', ' 2026-11']){
  assert.equal(api.invoiceMonthStart(period),null,period);
  assert.equal(api.leaseSubjectPreview(subject,period,'nl','Test unit'),null,period);
 }
});
test('complete invoice months preserve period, placeholders and selected language',()=>{
 for(const [locale,month] of [['nl','november'],['en','November'],['es','noviembre']]){
  assert.equal(api.invoiceMonthStart('2026-11'),'2026-11-01');
  assert.equal(api.leaseSubjectPreview(subject,'2026-11',locale,'Test unit'),`Huur Test unit — ${month} 2026`);
 }
 assert.equal(api.leaseSubjectPreview('{maand} {jaar} {unitadres}','2028-02','en',''),'February 2028 [unit]');
 assert.equal(api.leaseSubjectPreview('{maand} {jaar}','0001-01','en',''),'January 0001');
 assert.equal(api.leaseSubjectPreview('{maand} {jaar}','9999-12','en',''),'December 9999');
});
