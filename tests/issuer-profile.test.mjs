import test from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import ts from 'typescript';import {readFileSync} from 'node:fs';
const exports={};vm.runInNewContext(ts.transpileModule(readFileSync('lib/estates/issuer-profile.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports});
const base={name:'Private landlord',kind:'person',address:'Existing address',iban:'NL TEST ACCOUNT'};
test('private landlords need no company registration or tax number; old full addresses remain valid',()=>{const r=exports.normalizeIssuer(base);assert.equal(r.registration_number,'');assert.equal(r.tax_id,'');assert.equal(r.address,'Existing address');assert.equal(r.iban,'NLTESTACCOUNT');});
test('structured address replaces legacy address only when complete',()=>{const r=exports.normalizeIssuer({...base,street:'Example Street',house_number:'12',address_extra:'A',postal_code:'1234 AB',city:'Amsterdam',country:'Netherlands'});assert.equal(r.address,'Example Street 12 A\n1234 AB Amsterdam\nNetherlands');assert.throws(()=>exports.normalizeIssuer({...base,street:'Incomplete'}),/Complete street/);});
test('issuer validation rejects headers, unsafe websites, malformed details and overlong data',()=>{for(const invalid of [{email:'a@example.com\r\nBcc:b@example.com'},{reply_to:'a@example.com,b@example.com'},{website:'javascript:alert(1)'},{logo:'https://internal/logo.png'},{bic:'bad'},{country:'x'.repeat(121)},{kind:'admin'},{name:{}}])assert.throws(()=>exports.normalizeIssuer({...base,...invalid}));});
test('invoice prefixes are normalized before reaching database constraints',()=>{
 for(const [input,expected] of [[' mn ','MN'],['mn-2026','MN-2026'],['12','12']])assert.equal(exports.normalizeInvoicePrefix(input),expected);
 for(const input of ['',undefined,{},'M','-MN','Magdy Nashed','MN/2026','M'.repeat(21),'م ن'])assert.throws(()=>exports.normalizeInvoicePrefix(input),/2–20 character invoice prefix/);
});
test('prefix save errors explain corrections without exposing database constraints',()=>{
 assert.match(exports.issuerSaveError({code:'23505',message:'duplicate key value violates unique constraint "mzs_lease_issuers_prefix_key"'}),/already in use/);
 assert.match(exports.issuerSaveError({code:'23514',message:'violates check constraint "mzs_lease_issuers_prefix_check"'}),/2–20 character invoice prefix/);
 assert.equal(exports.issuerSaveError({code:'42501',message:'Permission denied'}),'Permission denied');
});
test('a private landlord with separate fields needs no legacy address or company identifiers',()=>{
 const result=exports.normalizeIssuer({name:'Fixture landlord',kind:'person',iban:'NL TEST ACCOUNT',street:'Example Street',house_number:'12',postal_code:'1234 AB',city:'Amsterdam',country:'Netherlands'});
 assert.equal(result.address,'Example Street 12\n1234 AB Amsterdam\nNetherlands');assert.equal(result.registration_number,'');assert.equal(result.tax_id,'');
 for(const field of ['street','city','country'])assert.throws(()=>exports.normalizeIssuer({...base,address:'',street:'Example Street',city:'Amsterdam',country:'Netherlands',[field]:''}),/Complete street/);
});
