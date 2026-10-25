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

test('company details are optional, trimmed, bounded and preserved when omitted by an older form',()=>{
 assert.equal(api.normalizeRelationship({...base,kind:'company'}).company_details,undefined);
 const r=api.normalizeRelationship({...base,kind:'company',company_details:{tax_id:' NL123 ',attention:' Finance ',invoice_email:' invoice@example.invalid ',invoice_address:{street:' Other ',city:'Madrid'},correspondence_address:{}}});
 assert.equal(r.company_details.tax_id,'NL123');assert.equal(r.company_details.attention,'Finance');assert.equal(r.company_details.invoice_address.street,'Other');assert.equal(r.company_details.correspondence_address,undefined);
 for(const company_details of [null,[],{unknown:'x'},{tax_id:4},{tax_id:'x'.repeat(61)},{attention:'x\ny'},{invoice_email:'x@invalid'},{correspondence_email:'one@example.invalid,two@example.invalid'},{website:'javascript:alert(1)'},{invoice_address:{unknown:'x'}},{invoice_address:null},{correspondence_address:{country:'x'.repeat(121)}}])assert.throws(()=>api.normalizeRelationship({...base,company_details}));
});
test('delivery details use independent address, email and attention fallbacks without mixing addresses',()=>{
 const record={...base,kind:'company',address:'Main street\nMain city',email:'main@example.invalid',company_details:{attention:'General contact',invoice_email:'invoice@example.invalid',invoice_address:{city:'Other city'},correspondence_attention:'Post desk'}};
 const invoice=api.relationshipDelivery(record);assert.equal(invoice.address,'Other city');assert.equal(invoice.email,'invoice@example.invalid');assert.equal(invoice.attention,'General contact');
 const post=api.relationshipDelivery(record,'correspondence');assert.equal(post.address,record.address);assert.equal(post.email,record.email);assert.equal(post.attention,'Post desk');
 const cleared=api.relationshipDelivery({...record,company_details:api.normalizeCompanyDetails({invoice_address:{},invoice_email:'',invoice_attention:''})});assert.equal(cleared.address,record.address);assert.equal(cleared.email,record.email);
 assert.equal(api.relationshipDelivery({...record,kind:'person'}).attention,'');
});
