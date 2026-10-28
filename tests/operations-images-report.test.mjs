import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {createRequire} from 'node:module';import vm from 'node:vm';import ts from 'typescript';import sharp from 'sharp';
const require=createRequire(import.meta.url);
function load(path){const output=ts.transpileModule(readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;const exports={};vm.runInNewContext(output,{exports,require,Buffer,Uint8Array,Number,Map,Set,Error});return exports;}
const {normalizeMaintenancePhoto,MAX_PHOTO_BYTES}=load('lib/property-operations/maintenance-photo.ts');
const {summarizeConceptCosts}=load('lib/property-operations/cost-report.ts');
test('maintenance image creates a fresh oriented JPEG without EXIF or trailing payload',async()=>{
 const original=await sharp({create:{width:80,height:40,channels:3,background:'#ff0000'}}).withMetadata({orientation:6,exif:{IFD0:{Artist:'Synthetic private metadata'}}}).jpeg().toBuffer();
 assert.ok((await sharp(original).metadata()).exif);
 const safe=await normalizeMaintenancePhoto(Buffer.concat([original,Buffer.from('SYNTHETIC_TRAILING_PAYLOAD')]));
 const meta=await sharp(safe).metadata();assert.equal(meta.format,'jpeg');assert.equal(meta.width,40);assert.equal(meta.height,80);assert.equal(meta.exif,undefined);assert.equal(meta.orientation,undefined);assert.ok(!safe.includes(Buffer.from('SYNTHETIC_TRAILING_PAYLOAD')));
});
test('maintenance image rejects active formats, corrupt bytes, huge files and pixel bombs',async()=>{
 for(const data of [Buffer.from('<svg><script>alert(1)</script></svg>'),Buffer.from([255,216,255,0,0]),new Uint8Array(MAX_PHOTO_BYTES+1)])await assert.rejects(normalizeMaintenancePhoto(data));
 const large=await sharp({create:{width:5000,height:5000,channels:3,background:'#ffffff'}}).png().toBuffer();await assert.rejects(normalizeMaintenancePhoto(large));
});
test('PNG and WebP become bounded metadata-free JPEGs',async()=>{
 for(const format of ['png','webp']){const original=await sharp({create:{width:40,height:40,channels:4,background:{r:20,g:30,b:40,alpha:0.5}}}).toFormat(format).toBuffer();const safe=await normalizeMaintenancePhoto(original);assert.equal((await sharp(safe).metadata()).format,'jpeg');assert.ok(safe.length<MAX_PHOTO_BYTES);}
});
test('concept reports group by original invoice month, object and category without inventing approved or paid costs',()=>{
 const row={id:'a',property_id:'p1',legal_entity_id:'e1',invoice_date:'2026-10-01',category:'maintenance',net_cents:101,vat_cents:21,gross_cents:122};
 const summary=summarizeConceptCosts([row,{...row,id:'b',property_id:'p2',invoice_date:'2026-11-01'}]);assert.equal(summary.total.gross,244);assert.equal(summary.months.length,2);assert.equal(summary.properties.length,2);assert.equal(summary.categories[0][1].count,2);assert.ok(!('paid' in summary.total));
 assert.throws(()=>summarizeConceptCosts([row,row]),/Invalid/);assert.throws(()=>summarizeConceptCosts([{...row,gross_cents:123}]),/Invalid/);assert.throws(()=>summarizeConceptCosts([{...row,net_cents:1.2}]),/Invalid/);
});
