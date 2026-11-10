import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import vm from 'node:vm';
import ts from 'typescript';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';

const require=createRequire(import.meta.url);
const source=readFileSync('app/admin/owner-stays/page.tsx','utf8');
const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
async function render(status,bookingStatus){
 const request={id:'synthetic-request',partner_id:'grant',check_in:'2030-06-10',check_out:'2030-06-12',guest_count:2,status,notes:null,booking_id:bookingStatus?'synthetic-booking':null};
 let guarded=false,selection='';
 const db={
  from(table){
   assert.equal(guarded,true,'Request data must remain behind the administrator guard');
   const rows=table==='profiles'?[{id:'person',full_name:'Synthetic Partner'}]:table==='projects'?[{id:'property',title:'Synthetic Property'}]:table==='mzs_property_partners'?[{id:'grant',profile_id:'person',project_id:'property'}]:[];
   const q={select(fields){if(table==='mzs_owner_stay_requests')selection=fields;return q},in(){return q},eq(){return q},order(){return q},lt(){return q},gt(){return q},limit(){return q},then(resolve,reject){
    const data=table==='mzs_owner_stay_requests'?[{...request,...(selection.includes('rental_bookings(status)')?{rental_bookings:bookingStatus?{status:bookingStatus}:null}:{})}]:rows;
    return Promise.resolve({data,error:null}).then(resolve,reject);
   }};return q;
  },
  rpc(name){assert.equal(name,'admin_list_rental_bookings');return {in(){return this},eq(){return this},order(){return this},limit:async()=>({data:[],error:null})};}
 };
 const deps={
  '../../../lib/admin/i18n-server':{getAdminI18n:async()=>({t:x=>x,locale:'en-GB'})},
  '../../../lib/security/estate-properties':{requireEstateAdmin:async()=>{guarded=true;return {db}}},
  'next/link':{default:({children,...props})=>React.createElement('a',props,children)},
  './actions':{grantPartner:()=>{},adjustBookingPrice:()=>{}},
  './OwnerStayDecision':{default:()=>React.createElement('button',null,'DECISION CONTROL')},
  './OwnerStayCleanup':{default:()=>React.createElement('button',null,'CLEANUP CONTROL')}
 };
 const exports={};vm.runInNewContext(code,{exports,require:n=>n in deps?deps[n]:require(n),Intl,console});
 const html=renderToStaticMarkup(await exports.default());
 return {article:html.match(/<article id="request-synthetic-request"[\s\S]*?<\/article>/)?.[0]??'',request};
}

test('A cancelled linked reservation is shown as cancelled even when the historic request remains confirmed',async()=>{
 const {article,request}=await render('confirmed','cancelled');
 assert.match(article,/CANCELLED/);assert.doesNotMatch(article,/CONFIRMED|DECISION CONTROL|CLEANUP CONTROL/);
 assert.match(article,/\/admin\/bookings\/synthetic-booking/);
 assert.equal(request.status,'confirmed','Rendering must not rewrite the original request');
});
test('An active confirmed owner stay retains its confirmed status and dossier link',async()=>{
 const {article}=await render('confirmed','confirmed');assert.match(article,/CONFIRMED/);assert.doesNotMatch(article,/CANCELLED|DECISION CONTROL|CLEANUP CONTROL/);
});
test('Unlinked pending requests still expose approval controls',async()=>{
 const {article}=await render('requested',null);assert.match(article,/REQUESTED/);assert.match(article,/DECISION CONTROL/);assert.doesNotMatch(article,/CLEANUP CONTROL/);
});
test('Closed unlinked requests retain their separate cleanup control',async()=>{
 const {article}=await render('cancelled',null);assert.match(article,/CANCELLED/);assert.match(article,/CLEANUP CONTROL/);assert.doesNotMatch(article,/DECISION CONTROL/);
});
