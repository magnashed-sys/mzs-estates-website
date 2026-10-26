import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import ts from "typescript";
import vm from "node:vm";

const source=(p)=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
function actionHarness(error){
 const js=ts.transpileModule(source("app/admin/owner-stays/actions.ts"),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 let requests=0, invalidations=[];
 const exports={};
 const db={rpc:async(name,args)=>{requests++;assert.equal(name,"mzs_admin_decide_owner_stay");assert.equal(args.p_approve,true);return {error:error?{message:error}:null};}};
 vm.runInNewContext(js,{
  exports,
  require(name){
   if(name==="next/cache")return {revalidatePath:p=>invalidations.push(p)};
   if(name.endsWith("/security/estate-properties"))return {requireEstateAdmin:async()=>({db})};
   throw Error(name);
  }
 });
 const form=new FormData();form.set("request_id","11111111-1111-4111-8111-111111111111");form.set("decision","approve");
 return {execute:()=>exports.decideOwnerStay({status:"idle",message:""},form),requests:()=>requests,invalidations};
}
test("A booking-overlap error is returned as visible feedback rather than crashing the page",async()=>{
 const h=actionHarness("Dates are no longer available");
 const result=await h.execute();
 assert.equal(result.status,"error");
 assert.match(result.message,/overlap/i);
 assert.match(result.message,/No owner stay was approved/);
 assert.equal(h.requests(),1);
 assert.deepEqual(h.invalidations,[]);
});
test("Duplicate or already reviewed requests do not generate a fatal server exception",async()=>{
 const h=actionHarness("Request unavailable or reviewed");
 const result=await h.execute();
 assert.equal(result.status,"error");
 assert.match(result.message,/already reviewed/i);
});
test("Successful approval triggers guarded refresh of owner stays and central bookings",async()=>{
 const h=actionHarness(null);
 const result=await h.execute();
 assert.equal(result.status,"success");
 assert.deepEqual(h.invalidations,["/admin/owner-stays","/admin","/admin/bookings"]);
});
test("Owner-stay page blocks approval when confirmed or blocked dates overlap",()=>{
 const page=source("app/admin/owner-stays/page.tsx");
 const form=source("app/admin/owner-stays/OwnerStayDecision.tsx");
 assert.match(page,/conflictByInterval/);
 assert.match(page,/\.in\('status',\['confirmed','blocked'\]\)/);
 assert.match(page,/\.lt\('check_in',span\.checkOut\)\.gt\('check_out',span\.checkIn\)/);
 assert.match(page,/Approval blocked: dates already occupied/);
 assert.match(page,/href=\{'\/admin\/bookings\/'\+conflict\.id\}/);
 assert.match(page,/<OwnerStayDecision id=\{r\.id\} blocked=\{blocked\}\/>/);
 assert.match(form,/disabled=\{pending\|\|blocked\}/);
 assert.match(form,/role=\{outcome\.status==="error"\?"alert":"status"\}/);
});
