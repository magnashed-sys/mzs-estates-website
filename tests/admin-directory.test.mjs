import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import ts from 'typescript';
const api={};new Function('exports',ts.transpileModule(readFileSync('lib/admin/directory.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(api);
test('directory has unique existing page destinations and complete bilingual labels',()=>{
 const links=api.adminDirectory.map(x=>x.href);assert.equal(new Set(links).size,links.length);
 for(const item of api.adminDirectory){assert.ok(item.en&&item.es&&item.group);assert.ok(existsSync('app'+item.href+'/page.tsx'),item.href);assert.ok(!item.href.includes('/api/'));}
});
test('directory search matches multiple words, Spanish accents and workspace filters',()=>{
 assert.ok(api.findAdminModules('FACTURACION').some(x=>x.en.includes('Zorgbalans')));
 assert.equal(api.findAdminModules('weekly review','Staff').length,1);
 assert.equal(api.findAdminModules('weekly','Capital').length,0);
 assert.equal(api.findAdminModules('not-a-real-module').length,0);
 assert.equal(api.findAdminModules('  ').length,api.adminDirectory.length);
 for(const key of ['batch upload','bulk review','accountant packages'])assert.ok(api.findAdminModules(key).length);
});
