import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import vm from "node:vm";
import ts from "typescript";
const exports={};
vm.runInNewContext(ts.transpileModule(readFileSync(new URL("../lib/admin/booking-return.ts",import.meta.url),"utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,URLSearchParams});
test("return to booking results keeps every filter and pagination",()=>{
 const path="/admin/bookings?q=A+%26+B&year=2025&property=abc&category=Guest+booking&status=confirmed&period=past&archive=archived&size=50&page=3";
 assert.equal(exports.bookingReturnHref(path),path);
});
test("return destinations cannot navigate away from the booking register",()=>{
 for(const input of [undefined,["/admin/bookings"],"https://example.com","//example.com","javascript:alert(1)","/admin/bookings/evil","/admin/bookings#hash","/admin/bookings/../system"]){
  assert.equal(exports.bookingReturnHref(input),"/admin/bookings");
 }
 assert.equal(exports.bookingReturnHref("/admin/bookings?returnTo=https://example.com&q=test&page=2&page=3"),"/admin/bookings?q=test");
});
