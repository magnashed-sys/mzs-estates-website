import test from 'node:test';import assert from 'node:assert/strict';import {spawnSync} from 'node:child_process';import {readFileSync} from 'node:fs';import {createRequire} from 'node:module';import vm from 'node:vm';import ts from 'typescript';
const require=createRequire(import.meta.url);
const module={exports:{}};vm.runInNewContext(ts.transpileModule(readFileSync('lib/accountancy/archive.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{module,exports:module.exports,require,URLSearchParams,TextDecoder,Date,Number,Error});const m=module.exports;
test('entity/year archive preserves role isolation, originals and review history in PostgreSQL',()=>{const r=spawnSync(process.execPath,['tests/db/accountancy-document-archive.cjs'],{encoding:'utf8',timeout:120000});assert.equal(r.status,0,r.stdout+'\n'+r.stderr);});
test('archive filters reject malformed, multi-value and overflowing inputs',()=>{
 for(const f of [{year:'2023x'},{year:'2200'},{entity:'invalid'},{entity:['a','b']},{category:'unknown'},{status:'paid'},{page:'1.5'},{page:'0'},{page:'Infinity'},{page:'100001'},{q:'x'.repeat(161)}])assert.throws(()=>m.archiveFilters(f));
 const f=m.archiveFilters({year:'2023',entity:'00000000-0000-4000-8000-000000000001',q:'balance & tax',page:'2'});const url=new URL(m.archiveHref(f,3),'https://example.invalid');assert.equal(url.searchParams.get('q'),'balance & tax');assert.equal(url.searchParams.get('page'),'3');assert.equal(m.archiveFilters({year:''}).year,'all');
});
test('server-side metadata rejects impossible dates and retains original user-entered Spanish notes',()=>{
 const form=()=>{const f=new FormData();for(const [k,v] of Object.entries({title:'Balance 2023',category:'balance_sheet',review_status:'needs_attention',period_label:'2023',document_date:'2024-09-13',notes:'Pendiente de revisión'}))f.set(k,v);return f;};
 assert.equal(m.archiveFields(form()).notes,'Pendiente de revisión');for(const date of ['2023-02-29','2024-02-30','bad']){const f=form();f.set('document_date',date);assert.throws(()=>m.archiveFields(f));}
 const f=form();f.set('notes','x'.repeat(4001));assert.throws(()=>m.archiveFields(f));
});
test('file path cannot escape its entity/year and PDF validation rejects wrong or oversized bytes',()=>{
 const id='00000000-0000-4000-8000-000000000001';assert.equal(m.documentPath(id,2023,id),`${id}/2023/${id}.pdf`);assert.throws(()=>m.documentPath('../bad',2023,id));assert.throws(()=>m.documentPath(id,2023.5,id));
 assert.throws(()=>m.validatePdf(new TextEncoder().encode('<html>')));assert.throws(()=>m.validatePdf(new Uint8Array(m.MAX_PDF_BYTES+1)));assert.doesNotThrow(()=>m.validatePdf(new TextEncoder().encode('%PDF-1.7\n')));
});
test('new archive has complete English and Spanish labels',()=>{
 assert.deepEqual(Object.keys(m.copy.en).sort(),Object.keys(m.copy.es).sort());for(const lang of ['en','es']){for(const key of m.categories)assert.ok(m.categoryLabels[lang][key]);for(const key of m.statuses)assert.ok(m.statusLabels[lang][key]);}
});
