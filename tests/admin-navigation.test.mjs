import {adminI18nFixture} from './helpers/admin-i18n.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import vm from 'node:vm';
import ts from 'typescript';
const require=createRequire(import.meta.url),React=require('react'),{renderToStaticMarkup}=require('react-dom/server');
function compile(file,mocks){const exports={};vm.runInNewContext(ts.transpileModule(readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText,{exports,require:n=>n.includes('/admin/i18n')?adminI18nFixture():n in mocks?mocks[n]:n.endsWith('.css')?{default:{}}:require(n)});return exports;}
const nav=()=>compile('app/admin/workspaces/WorkspaceNavigation.tsx',{'next/link':{default:({children,...p})=>React.createElement('a',p,children)},'next/navigation':{usePathname:()=>'/admin/workspaces/estates/time-report',useSearchParams:()=>new URLSearchParams()}});
test('one ordered eight-tab navigation with one active Staff tab on the time report',()=>{
 const html=renderToStaticMarkup(React.createElement(nav().default));
 const labels=[...html.matchAll(/<a\b[^>]*>([^<]+)<\/a>/g)].map(x=>x[1]);assert.deepEqual(labels,['Cockpit','Bookings','Real Estate','Capital','Relationships','Staff','Accountancy','System']);
 assert.equal((html.match(/aria-current="page"/g)||[]).length,1);assert.match(html,/aria-current="page"[^>]*>Staff/);
});
test('specialist routes keep the correct primary section, including mixed legacy action queues',()=>{
 const f=nav().activeWorkspace;
 for(const [path,q,expected] of [['/admin/workspaces/estates/history',null,'Accountancy'],['/admin/workspaces/estates/expenses/sales-export',null,'Accountancy'],['/admin/workspaces/estates/actions','corrections','Staff'],['/admin/workspaces/estates/actions','budgets','Real Estate'],['/admin/owner-stays',null,'Bookings'],['/admin/member-companies',null,'Relationships'],['/admin/project-access',null,'Relationships'],['/admin/group/capital/deals/123',null,'Capital'],['/admin/property-operations-pilot',null,'System'],['/admin/projects/123',null,'Real Estate']])assert.equal(f(path,q),expected);
});
test('Staff and Accountancy hubs enforce admin access before rendering module links',async()=>{
 for(const name of ['staff','accountancy']){
  const page=compile('app/admin/workspaces/'+name+'/page.tsx',{'next/link':{default:'a'},'../../../../lib/security/estate-properties':{requireEstateAdmin:async()=>{throw Error('unauthorized');}}});
  await assert.rejects(page.default(),/unauthorized/);
 }
});
