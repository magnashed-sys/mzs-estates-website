import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=(path)=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const admin=read('app/admin/AdminPanels.tsx');
test('Admin core refresh excludes three large optional registers',()=>{
 const start=admin.indexOf('const results = await Promise.all([');
 const end=admin.indexOf('assertComplete(results);',start);
 assert.ok(start>0&&end>start);
 const core=admin.slice(start,end);
 assert.ok(admin.slice(0,start).includes('from("access_requests")'),"access requests missing from core loader");
 for(const name of ['access_invitations','profiles','projects'])
  assert.ok(core.includes(name),name+' missing from core');
 for(const optional of ['mzs_member_companies','mzs_member_contact_details','offerings'])
  assert.ok(!core.includes('from("'+optional+'")'),optional+' unexpectedly eager');
});
test('detail registers are lazy and inaccessible data is not shown as empty success',()=>{
 assert.match(admin,/tab==="companies" \|\| \(tab==="relationships" && relationshipView==="accounts"\)/);
 assert.match(admin,/directoryVersion===refreshVersion/);
 assert.match(admin,/offeringsVersion===refreshVersion/);
 assert.match(admin,/tab!=="projects"/);
 assert.match(admin,/assertComplete\(\[companies,contacts\]\)/);
 assert.match(admin,/assertComplete\(\[result\]\)/);
 assert.match(admin,/directoryState==="error"/);
 assert.match(admin,/offeringsState==="error"/);
 assert.match(admin,/directoryState==="ready"&&<>/);
});
test('specialized modules are loaded on demand, not in the initial Admin bundle',()=>{
 assert.match(admin,/import dynamic from "next\/dynamic"/);
 for(const module of ['RequestProjectApproval']){
  assert.match(admin,new RegExp('dynamic\\(\\(\\) => import\\("\\./'+module+'"\\)'));
  assert.doesNotMatch(admin,new RegExp('import '+module+' from'));
 }
});
