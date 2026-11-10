import {allocateInterestCredits} from './interest-allocation';

export type ClientInterestTerm = {
 due_date:string;scheduled:number;credit:number;settled:number;remaining:number;
};
export type ClientCapitalSummary = {
 id:string;label:string;party_role:'lender'|'borrower';principal:number;currency:'EUR';
 annual_rate:number|null;start_date:string|null;end_date:string|null;
 total_interest_received:number;total_interest_paid:number;
 interest_payments:{date:string;amount:number}[];
 interest:{as_of:string;terms:ClientInterestTerm[];remaining:number;unallocated_credit:number;
  next:ClientInterestTerm|null;credits:{from:string;to:string;amount:number}[]};
};
type RecordValue=Record<string,unknown>;
const object=(v:unknown):RecordValue=>{
 if(!v||typeof v!=='object'||Array.isArray(v))throw Error('Invalid capital summary');
 return v as RecordValue;
};
const text=(v:unknown)=>{if(typeof v!=='string'||!v.trim())throw Error('Missing capital value');return v;};
function amount(v:unknown){
 if((typeof v!=='number'&&typeof v!=='string')||v==='')throw Error('Invalid capital amount');
 const n=Number(v),c=Math.round(n*100);
 if(!Number.isFinite(n)||n<0||!Number.isSafeInteger(c)||c/100!==n)throw Error('Invalid capital amount');
 return n;
}
function day(v:unknown){
 const s=text(v);
 if(!/^\d{4}-\d{2}-\d{2}$/.test(s)||!Number.isFinite(Date.parse(s))||new Date(s).toISOString().slice(0,10)!==s)throw Error('Invalid capital date');
 return s;
}
export function capitalSummaryDay(now=new Date()){
 return new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Madrid',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
}

/** The RPC supplies only the caller's active grants. Calculate with the same
 * allocator as admin reporting, then strip source IDs and all unknown fields.
 * Never turn a missing/partial projection into an apparently settled dossier. */
export function buildClientCapitalSummaries(input:unknown,asOf=capitalSummaryDay()):ClientCapitalSummary[]{
 day(asOf);
 if(!Array.isArray(input))throw Error('Capital summaries unavailable');
 const ids=new Set<string>();
 return input.map(value=>{
  const d=object(value),id=text(d.id);
  if(ids.has(id))throw Error('Duplicate capital dossier');ids.add(id);
  if(d.summary_version!==2||!Array.isArray(d.interest_schedule)||!Array.isArray(d.interest_payments))throw Error('Incomplete capital summary');
  if(d.currency!=='EUR'||(d.party_role!=='lender'&&d.party_role!=='borrower'))throw Error('Invalid capital perspective');
  const terms=d.interest_schedule.map(value=>{const t=object(value);return {id:text(t.id),kind:'interest',due_date:day(t.due_date),amount:amount(t.amount)};});
  const termIds=new Set(terms.map(t=>t.id));
  const payments=d.interest_payments.map(value=>{
   const p=object(value),instalment_id=text(p.instalment_id);
   if(!termIds.has(instalment_id)||p.is_void===true)throw Error('Incomplete capital schedule');
   return {instalment_id,amount:amount(p.amount),date:day(p.date),is_void:false};
  });
  const ledger=allocateInterestCredits(terms,payments);
  const received=amount(d.total_interest_received),paid=amount(d.total_interest_paid);
  if((d.party_role==='lender'&&(received!==ledger.confirmedCash||paid!==0))||
   (d.party_role==='borrower'&&(paid!==ledger.confirmedCash||received!==0)))throw Error('Capital cash reconciliation failed');
  const rate=d.annual_rate===null?null:Number(d.annual_rate);
  if(rate!==null&&(!Number.isFinite(rate)||rate<0||rate>100))throw Error('Invalid capital rate');
  const rows=ledger.rows.map(t=>({due_date:t.due_date,scheduled:t.scheduled,credit:t.creditApplied,
   settled:Math.round((t.scheduled-t.remaining)*100)/100,remaining:t.remaining}));
  return {id,label:text(d.label),party_role:d.party_role,principal:amount(d.principal),currency:'EUR',
   annual_rate:rate,start_date:d.start_date===null?null:day(d.start_date),end_date:d.end_date===null?null:day(d.end_date),
   total_interest_received:received,total_interest_paid:paid,
   interest_payments:payments.map(p=>({date:p.date,amount:p.amount})).sort((a,b)=>b.date.localeCompare(a.date)),
   interest:{as_of:asOf,terms:rows,remaining:rows.reduce((sum,t)=>sum+Math.round(t.remaining*100),0)/100,
    next:rows.find(t=>t.remaining>0)??null,unallocated_credit:ledger.unappliedCredit,
    credits:ledger.credits.map(c=>({from:ledger.byId.get(c.sourceId)!.due_date,to:ledger.byId.get(c.targetId)!.due_date,amount:c.amount}))}
  };
 });
}
