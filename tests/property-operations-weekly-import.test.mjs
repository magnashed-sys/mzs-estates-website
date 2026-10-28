import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const source=readFileSync(new URL('../lib/property-operations/weekly-import.ts',import.meta.url),'utf8');
const output=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const e={};vm.runInNewContext(output,{exports:e,Map,Set,Date});
const {parseWeeklyCostsCsv,summarizeWeeklyCosts,normalizedCostLocation}=e;
const headers=['referentie','jaar','week','van','tot','locatie','soort','omschrijving',
  'kosten_eur','doorfactureren','bronbericht','controle','uren_schatting','doorbelasting_eur','factuur_referentie'];
function csv(rows){return '\uFEFF'+[headers,...rows].map(r=>r.map(v=>String(v).includes(';')?'"'+String(v).replaceAll('"','""')+'"':String(v)).join(';')).join('\r\n');}
const record=(id,location,cost,status,estimate='',recharge='',invoice='')=>
 [id,'2026','7','2026-02-09','2026-02-15',location,'Schoonmaak','Wekelijkse schoonmaak',cost,status,'#1','Uit chat',estimate,recharge,invoice];
test('weekly cost preview preserves gross costs and separates already prepared charge amounts',()=>{
 const input=csv([
  record('CW0001','Zorg','50,00','Ja','2','50,00','historische-specificatie'),
  record('CW0002','Zorgbalans / Prettighuis','12,50','Ja','1','25,00','historische-specificatie'),
  record('CW0003','Beverwijk','125,00','Nee'),
  record('CW0004','Kennemerlaan','60,00','Te beoordelen')
 ]);
 const parsed=parseWeeklyCostsCsv(input);const out=summarizeWeeklyCosts(parsed);
 assert.equal(out.rowCount,4);
 assert.equal(out.totalCostCents,24750);
 assert.equal(out.pricedRechargeCents,7500);
 assert.equal(out.estimatedBillableHours,3);
 assert.equal(out.reviewCount,1);
 assert.equal(out.rechargeCount,2);
 assert.equal(out.confirmedNoCount,1);
 const zorg=out.groups.find(x=>x.location==='Zorgbalans');
 assert.equal(zorg.costCents,6250);
 assert.equal(zorg.rechargeCents,7500);
});
test('source location names are retained; Zorg and Prettig Thuis are presentation aliases only',()=>{
 for(const a of ['Zorg','Zorgbalans','Prettig Thuis','Prettighuis','Zorgbalans / Prettighuis']){
  assert.equal(normalizedCostLocation(a),'Zorgbalans');
 }
 assert.equal(normalizedCostLocation('Kennemerlaan'),'Kennemerlaan');
 const r=parseWeeklyCostsCsv(csv([record('CW0001','Zorg','50,00','Ja','2','50,00','concept-7113')]));
 assert.equal(r[0].originalLocation,'Zorg');
 assert.equal(r[0].location,'Zorgbalans');
});
test('CSV quotes, commas in amount, quoted semicolons and BOM parse without dropping lines',()=>{
 const input=csv([record('CW0001','Andromedastraat','112,50','Te beoordelen')]).replace('Wekelijkse schoonmaak','"Schoonmaak; toegang"');
 const p=parseWeeklyCostsCsv(input);
 assert.equal(p[0].description,'Schoonmaak; toegang');
 assert.equal(p[0].costCents,11250);
});
test('import rejects duplicates, partial data and unexplained assumed hours',()=>{
 const r=record('CW0001','Zorgbalans','25,00','Ja','1','25,00','invoice');
 assert.throws(()=>parseWeeklyCostsCsv(csv([r,r])),/Dubbele/);
 assert.throws(()=>parseWeeklyCostsCsv(csv([r.slice(0,8)])),/velden/);
 assert.throws(()=>parseWeeklyCostsCsv(csv([record('CW0002','Zorg','20,00','Ja','1','','invoice')])),/Inconsistente/);
 assert.throws(()=>parseWeeklyCostsCsv(csv([record('CW0002','Zorg','20,00','Te beoordelen','1','25,00','invoice')])),/Inconsistente/);
 assert.throws(()=>parseWeeklyCostsCsv(csv([record('CW0002','Zorg','20,00','Ja','','','invoice')])),/referentie zonder doorbelasting/);
 assert.throws(()=>parseWeeklyCostsCsv(csv([record('CW0002','Zorg','1.234,00','Nee')])),/bedrag/);
 assert.throws(()=>parseWeeklyCostsCsv(csv([record('CW0002','Zorg','20,00','Nee')]).replace('2026-02-09','2026-02-30')),/Controleer jaar/);
});
test('admin import remains browser-only, requires CSV explicitly and has no network mutations',()=>{
 const component=readFileSync(new URL('../app/admin/workspaces/estates/expenses/WeeklyCostsImport.tsx',import.meta.url),'utf8');
 const page=readFileSync(new URL('../app/admin/workspaces/estates/expenses/page.tsx',import.meta.url),'utf8');
 assert.match(page,/await requireEstateAdmin\(\)/);
 assert.match(page,/<WeeklyCostsImport/);
 assert.match(component,/type="file"/);
 assert.match(component,/file\.text\(\)/);
 assert.match(component,/parseWeeklyCostsCsv\(text\)/);
 assert.doesNotMatch(component,/fetch\(|localStorage|sessionStorage|\.insert\(|\.upsert\(|\.update\(|\.delete\(|[.]rpc\(/);
});
