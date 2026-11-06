import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import ts from 'typescript';
const native=createRequire(import.meta.url),cache=new Map();
function load(file){file=path.resolve(file);if(cache.has(file))return cache.get(file);const exports={};cache.set(file,exports);new Function('exports','require','Buffer','TextEncoder','TextDecoder',ts.transpileModule(readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(exports,n=>n.startsWith('.')?load(path.resolve(path.dirname(file),n+'.ts')):native(n),Buffer,TextEncoder,TextDecoder);return exports;}
const model=load('lib/accountancy/bank/model.ts'),file=load('lib/accountancy/bank/file.ts'),archive=load('lib/property-operations/accountant-archive.ts'),exp=load('lib/accountancy/bank/export.ts');
function preview(text,extra={}){const table=model.parseBankCsv(text,';');return model.bankPreview(table,{delimiter:';',decimal:',',dateFormat:'dmy',mapping:model.suggestMapping(table.headers),...extra},2025);}
test('Spanish bank exports preserve signs, cents, quoted text, debit/credit and valid dates',()=>{
 const p=preview('Fecha;Concepto;Importe;Saldo\n02/01/2025;"Factura; referencia";-1.234,56;5.000,00\n03/01/2025;Ingreso;+2.000,00;7.000,00');assert.deepEqual(p.errors,[]);assert.equal(p.rows[0].amount_cents,-123456);assert.equal(p.rows[1].amount_cents,200000);
 const q=preview('Fecha;Concepto;Debe;Haber\n02/01/2025;Pago;150,25;\n03/01/2025;Ingreso;;200,50');assert.deepEqual(q.errors,[]);assert.equal(q.total_cents,5025);
 for(const text of ['31/02/2025;Bad date;1,00','01/01/2024;Wrong year;1,00','01/01/2025;Zero;0,00','01/01/2025;Bad group;1.2,00'])assert.equal(preview('Fecha;Concepto;Importe\n'+text).errors.length,1);
 assert.equal(preview('Fecha;Concepto;Importe\n01/01/2025;Same;1,00\n01/01/2025;Same;1,00').errors.length,1);
});
function workbook({formula=false}={}){
 const xml=[['[Content_Types].xml','<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>'],['xl/workbook.xml','<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Bank" sheetId="1" r:id="rId1"/></sheets></workbook>'],['xl/_rels/workbook.xml.rels','<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>'],['xl/worksheets/sheet1.xml',`<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData><row r="1"><c r="A1" t="inlineStr"><is><t>Date</t></is></c><c r="B1" t="inlineStr"><is><t>Description</t></is></c><c r="C1" t="inlineStr"><is><t>Amount</t></is></c></row><row r="2"><c r="A2" t="inlineStr"><is><t>2025-01-02</t></is></c><c r="B2" t="inlineStr"><is><t>Synthetic transaction</t></is></c><c r="C2">${formula?'<f>1+1</f>':''}<v>-125.5</v></c></row></sheetData></worksheet>`]];
 // The ZIP helper deliberately rejects square brackets in names; create a standards-compliant fixture with fflate.
 return Buffer.from(native('fflate').zipSync(Object.fromEntries(xml.map(([n,s])=>[n,new TextEncoder().encode(s)]))));
}
test('XLSX numeric cells use selected decimal separator; formulas and oversized archives are rejected',async()=>{
 const table=await file.bankFile(workbook(),'test.xlsx',';',',');const result=model.bankPreview(table,{delimiter:';',decimal:',',dateFormat:'iso',mapping:model.suggestMapping(table.headers)},2025);assert.deepEqual(result.errors,[]);assert.equal(result.rows[0].amount_cents,-12550);
 await assert.rejects(file.bankFile(workbook({formula:true}),'test.xlsx',';'),/formulas/);
 const bomb=Buffer.from(native('fflate').zipSync({'big.xml':new Uint8Array(9*1024*1024)}));await assert.rejects(file.bankFile(bomb,'test.xlsx',';'),/Unsupported|large|limit/);
 await assert.rejects(file.bankFile(Buffer.alloc(512*1024+1),'test.csv',';'),/512/);
});
test('export preserves bank originals, RC direction, unresolved rows and correction history without double booking',()=>{
 const bytes=Buffer.from('date;amount\n2025-01-02;100'),sha=native('node:crypto').createHash('sha256').update(bytes).digest('hex');
 const s={issuer_id:'entity',year:2025,accounts:[{id:'account',issuer_id:'entity',name:'Bank',iban:'ES123',opening_on:'2025-01-01',opening_cents:1000,evidence:'Statement'}],batches:[{id:'batch',account_id:'account',filename:'original.csv',sha256:sha,raw_base64:bytes.toString('base64'),created_at:'2025-02-01'}],transactions:[{id:'tx',account_id:'account',batch_id:'batch',row:2,booked_on:'2025-01-02',description:'=NotAFormula',amount_cents:10000,reference:'ref',balance_cents:11000}],allocations:[{id:'opening',issuer_id:'entity',transaction_id:null,person_id:'person',booked_on:'2025-01-01',kind:'opening',amount_cents:-5000,note:'Opening',created_at:'2025-01-01',reversed_at:null},{id:'alloc',issuer_id:'entity',transaction_id:'tx',person_id:'person',booked_on:'2025-01-02',kind:'current_account',amount_cents:4000,note:'Deposit',created_at:'2025-02-01',reversed_at:null}],people:[{id:'person',name:'Person'}],targets:[]};
 const files=exp.bankAccountantFiles(s,'entity',2025),text=n=>Buffer.from(files.find(f=>f.name==='bank/'+n).bytes).toString();
 assert.deepEqual(Buffer.from(files.find(f=>f.name.endsWith('/batch.csv')).bytes),bytes);assert.match(text('current-account-balances.csv'),/person_owes_SL/);assert.match(text('current-account-balances.csv'),/-50.00/);assert.match(text('transactions.csv'),/'=NotAFormula/);assert.match(text('review-items.csv'),/60.00/);assert.match(text('README.txt'),/NOT new payments/);
 assert.throws(()=>exp.bankAccountantFiles({...s,issuer_id:'other'},'entity',2025),/entity mismatch/);
 assert.throws(()=>exp.bankAccountantFiles({...s,batches:[{...s.batches[0],sha256:'bad'}]},'entity',2025),/hash mismatch/);
});
