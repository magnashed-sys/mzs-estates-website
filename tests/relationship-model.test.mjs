import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const api={};vm.runInNewContext(ts.transpileModule(readFileSync('lib/relationships/model.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports:api});
const base={name:'Example client',kind:'person',roles:['client']};
test('a relationship needs no login, optional billing fields or rental role',()=>{
 const r=api.normalizeRelationship(base);assert.equal(r.profile_id,null);assert.equal(r.email,'');assert.equal(r.address,'');assert.equal(r.roles.join(','),'client');
});
test('untrusted fields cannot activate an account or grant privileges',()=>{
 const r=api.normalizeRelationship({...base,name:' Example client ',role:'admin',is_active:true,id:'other',email_normalized:'other',roles:['client','tenant','tenant']});
 assert.equal(r.name,'Example client');assert.equal(r.role,undefined);assert.equal(r.is_active,undefined);assert.equal(r.id,undefined);assert.equal(r.email_normalized,undefined);assert.equal(r.roles.join(','),'client,tenant');
 for(const invalid of [{roles:['admin']},{roles:[]},{roles:[null]},{kind:'admin'},{profile_id:'not-a-uuid'},{profile_id:false},{profile_id:0},{email:'one@example.invalid,two@example.invalid'},{email:'a@example.invalid\r\nBcc: b@example.invalid'},{name:{}},{phone:'x'.repeat(101)}])assert.throws(()=>api.normalizeRelationship({...base,...invalid}));
});
test('existing accounts appear once when extended; company contacts do not replace the person',()=>{
 const members=[{id:'one'},{id:'two'},{id:'three'}];const records=[{kind:'person',profile_id:'one'},{kind:'company',profile_id:'two'}];
 assert.equal(api.unextendedMembers(records,members).map(x=>x.id).join(','),'two,three');
});

test('structured addresses format all fields while legacy addresses survive unrelated edits',()=>{
 const legacy=api.normalizeRelationship({...base,address:'Existing address\nCity'});assert.equal(legacy.address,'Existing address\nCity');assert.equal(legacy.billing_address,undefined);
 const r=api.normalizeRelationship({...base,address:'ignored',billing_address:{street:' Street ',house_number:'12B',addition:'Unit 3',postal_code:'1234 AB',city:'City',region:'Region',country:'Country'}});assert.equal(r.address,'Street 12B\nUnit 3\n1234 AB City\nRegion\nCountry');assert.equal(r.billing_address.street,'Street');
 assert.equal(api.normalizeRelationship({...base,address:'Old',billing_address:{}}).address,'');
 for(const bad of [null,[],{unknown:'x'},{city:1},{street:'line\nbreak'},{postal_code:'x'.repeat(31)}])assert.throws(()=>api.normalizeRelationship({...base,billing_address:bad}));
});
