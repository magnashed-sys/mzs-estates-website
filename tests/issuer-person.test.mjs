import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import ts from 'typescript';
import {readFileSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';

function load(file, dependencies={}) {
 const exports={};
 vm.runInNewContext(ts.transpileModule(readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,require:key=>{if(key in dependencies)return dependencies[key];throw Error('Unexpected import '+key);}});
 return exports;
}
const person=load('lib/estates/issuer-person.ts');
const reader=load('lib/estates/read-issuer-person.ts',{'./issuer-person':person});
const own='11111111-1111-4111-8111-111111111111',other='22222222-2222-4222-8222-222222222222',rid='33333333-3333-4333-8333-333333333333';
const profile={id:own,full_name:'Own profile',email:'own@example.invalid'};
const contact={phone:'+31612345678',street_address:'Profile street',house_number:'7',address_addition:'A',postal_code:'1234 AB',city:'Amsterdam',region:'Noord-Holland',country:'Netherlands'};
const relationship={id:rid,name:'Person dossier',kind:'person',address:'Dossier full address',email:'',phone:'',profile_id:other,billing_address:{}};
function database(tables,failTable) {
 const reads=[];
 return {reads,from(table){let rows=tables[table]||[];reads.push(table);return {
  select(){return this;},eq(key,value){rows=rows.filter(r=>r[key]===value);return this;},in(key,values){rows=rows.filter(r=>values.includes(r[key]));return this;},
  async maybeSingle(){return {data:rows[0]||null,error:table===failTable?{message:'fixture failure'}:rows.length>1?{message:'duplicate'}:null};},
 };}};
}
test('self imports structured profile fields including region, without bank or account writes',async()=>{
 const db=database({profiles:[{...profile,role:'admin'}],mzs_member_contact_details:[{...contact,user_id:own}]});
 const result=await reader.readIssuerPerson(db,own,'self');
 assert.equal(result.fields.name,'Own profile');assert.equal(result.fields.street,'Profile street');assert.equal(result.fields.region,'Noord-Holland');assert.equal(result.fields.relationship_id,'');
 for(const key of ['iban','prefix','next_number','account_holder','bic'])assert.equal(key in result.fields,false);
});
test('person dossier address wins as a whole; profile supplies only missing contact data',()=>{
 const r=person.personIssuerFields({...relationship,billing_address:{street:'Dossier street',city:'Madrid',country:'Spain'}},profile,contact);
 assert.equal(r.street,'Dossier street');assert.equal(r.house_number,'');assert.equal(r.region,'');assert.equal(r.email,profile.email);assert.equal(r.phone,contact.phone);
 const legacy=person.personIssuerFields(relationship,profile,contact);
 assert.equal(legacy.address,relationship.address);assert.equal(legacy.street,'');assert.equal(legacy.city,'');
 const empty=person.personIssuerFields(null,{id:own,full_name:null,email:null},null);
 assert.equal(empty.name,'');assert.equal(empty.street,'');assert.equal(empty.address,'');
});
test('person lookup rejects invalid sources, companies, missing accounts, other admins and query failures',async()=>{
 const db=database({profiles:[{...profile,id:other,role:'admin'}],mzs_lease_relationships:[{...relationship,kind:'company'}]});
 for(const source of ['unknown','relationship:wrong',{},'self:extra'])assert.ok((await reader.readIssuerPerson(db,own,source)).error);
 assert.equal(db.reads.length,0);
 for(const source of ['profile:'+other,'relationship:'+rid,'profile:'+own])assert.ok((await reader.readIssuerPerson(db,own,source)).error);
 const failed=database({profiles:[{...profile,role:'admin'}]},'mzs_member_contact_details');
 assert.ok((await reader.readIssuerPerson(failed,own,'self')).error);
});
test('profile lookup reuses a linked person, and an offline person requires no account',async()=>{
 const db=database({profiles:[{...profile,id:other,role:'client'}],mzs_lease_relationships:[relationship]});
 assert.equal((await reader.readIssuerPerson(db,own,'profile:'+other)).fields.relationship_id,rid);
 const offline=database({mzs_lease_relationships:[{...relationship,profile_id:null}]});
 assert.equal((await reader.readIssuerPerson(offline,own,'relationship:'+rid)).fields.name,'Person dossier');
 assert.deepEqual(offline.reads,['mzs_lease_relationships']);
});
test('person import action checks the active administrator guard before any lookup',async()=>{
 let reads=0;
 const actions=load('app/admin/group/estates/contracts/actions.ts',{
  '../../../../../lib/estates/issuer-profile':{},'next/cache':{},
  '../../../../../lib/security/estate-contracts':{requireContractAdmin:async()=>{throw Error('Denied');}},
  '../../../../../lib/estates/read-issuer-person':{readIssuerPerson:async()=>{reads++;}},
 });
 await assert.rejects(actions.importIssuerPerson('self'),/Denied/);assert.equal(reads,0);
});
test('region migration accepts bounded region values and retains issuer detail validation',async()=>{
 const db=new PGlite();
 try{
  await db.exec('create schema mzs_private; create role anon; create role authenticated; create role service_role;');
  const before=readFileSync('supabase/migrations/20261025092439_issuer_business_profiles.sql','utf8').split('alter table public.mzs_lease_issuers')[0];
  await db.exec(before);
  await db.exec("create table saved_issuer(details jsonb check(mzs_private.valid_issuer_details(details))); insert into saved_issuer values ('{\"city\":\"Amsterdam\"}');");
  await db.exec(readFileSync('supabase/migrations/20261025125646_issuer_person_address_region.sql','utf8'));
  const {rows:[r]}=await db.query("select mzs_private.valid_issuer_details('{\"region\":\"Noord-Holland\"}') as valid, mzs_private.valid_issuer_details(jsonb_build_object('region',repeat('x',121))) as too_long, mzs_private.valid_issuer_details('{\"unknown\":\"x\"}') as unknown, mzs_private.valid_issuer_details('{\"email\":\"invalid\"}') as bad_email, (select details from saved_issuer) as old;");
  assert.equal(r.valid,true);assert.equal(r.too_long,false);assert.equal(r.unknown,false);assert.equal(r.bad_email,false);assert.deepEqual(r.old,{city:'Amsterdam'});
  const normalization=load('lib/estates/issuer-profile.ts').normalizeIssuer;
  const saved=normalization({...person.personIssuerFields(null,profile,contact),iban:'NLTESTACCOUNT'});
  assert.equal(saved.details.region,contact.region);assert.ok(saved.address.includes('\nNoord-Holland\n'));
 }finally{await db.close();}
});
