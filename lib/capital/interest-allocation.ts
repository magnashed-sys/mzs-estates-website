/** Interest-only allocation, in exact euro cents. A real receipt is stored ONCE,
 * against its source term. Surplus first covers the oldest unpaid interest term
 * on the SAME loan (including historical shortfalls), then upcoming interest.
 * Principal and fees must never use, or receive, interest credits.
 */
export type InterestTerm = {id:string;kind:string;due_date:string;amount:number|string};
export type InterestPayment = {instalment_id:string;amount:number|string;is_void:boolean};
export type InterestAllocationRow = {
 id:string;due_date:string;scheduled:number;directPaid:number;creditApplied:number;
 excessFromThisTerm:number;creditDistributed:number;remaining:number;
};
export type InterestAllocation = {
 rows:InterestAllocationRow[]; byId:Map<string,InterestAllocationRow>;
 confirmedCash:number;totalScheduled:number;unappliedCredit:number;
 credits:{sourceId:string;targetId:string;amount:number}[];
};
function cents(value:number|string){
 const n=Number(value);
 if(!Number.isFinite(n)||n<0||Math.round(n*100)/100!==n)throw new Error('Invalid interest amount');
 return Math.round(n*100);
}
export function allocateInterestCredits(terms:InterestTerm[],payments:InterestPayment[]):InterestAllocation{
 const sorted=terms.filter(t=>t.kind==='interest').slice().sort((a,b)=>a.due_date.localeCompare(b.due_date)||a.id.localeCompare(b.id));
 const direct=new Map(sorted.map(t=>[t.id,0]));
 if(direct.size!==sorted.length)throw new Error('Duplicate interest term');
 for(const p of payments){
  if(p.is_void)continue;
  if(!direct.has(p.instalment_id))continue;
  direct.set(p.instalment_id,direct.get(p.instalment_id)!+cents(p.amount));
 }
 const raw=sorted.map(t=>({
  id:t.id,due_date:t.due_date,scheduled:cents(t.amount),directPaid:direct.get(t.id)||0,
  creditApplied:0,excessFromThisTerm:Math.max(0,(direct.get(t.id)||0)-cents(t.amount)),
  creditDistributed:0,remaining:Math.max(0,cents(t.amount)-(direct.get(t.id)||0))
 }));
 const credits:{sourceId:string;targetId:string;amount:number}[]=[];
 for(const source of raw){
  let surplus=source.excessFromThisTerm;
  for(const target of raw){
   if(!surplus)break;
   if(target.id===source.id||target.remaining===0)continue;
   const used=Math.min(surplus,target.remaining);
   target.creditApplied+=used;target.remaining-=used;source.creditDistributed+=used;surplus-=used;
   credits.push({sourceId:source.id,targetId:target.id,amount:used/100});
  }
 }
 const rows=raw.map(r=>({
  id:r.id,due_date:r.due_date,scheduled:r.scheduled/100,directPaid:r.directPaid/100,
  creditApplied:r.creditApplied/100,excessFromThisTerm:r.excessFromThisTerm/100,
  creditDistributed:r.creditDistributed/100,remaining:r.remaining/100
 }));
 return {
  rows,byId:new Map(rows.map(r=>[r.id,r])),
  confirmedCash:raw.reduce((n,r)=>n+r.directPaid,0)/100,
  totalScheduled:raw.reduce((n,r)=>n+r.scheduled,0)/100,
  unappliedCredit:raw.reduce((n,r)=>n+r.excessFromThisTerm-r.creditDistributed,0)/100,
  credits
 };
}
