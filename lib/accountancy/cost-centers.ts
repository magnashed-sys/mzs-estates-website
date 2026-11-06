import {annualCategory,type YearSource} from './administration';
import {normalizeIssuedInvoice,euroCents,type IssuedInvoice} from '../property-operations/sales-reconciliation';
export type IncomeSource='leases'|'bookings'|'external'|'services';
export type IncomeAllocation={year_id:string;source:IncomeSource;invoice_id:string;property_id:string|null;project_id:string|null;evidence_reference:string;revision:number};
const sourceNames={leases:'rental_contract',bookings:'holiday_booking',external:'external_cost_invoice',services:'standalone_invoice'} as const;
export function yearIncome(s:YearSource){
 const records=Object.entries(sourceNames).flatMap(([key,source])=>(s.sales[key]??[]).filter((i:IssuedInvoice)=>i.issued_on.startsWith(s.administration.fiscal_year+'-')).map((i:IssuedInvoice)=>({
  ...normalizeIssuedInvoice({...i,source},s.administration.issuer_id,s.administration.fiscal_year),allocation_source:key as IncomeSource,
  gross_cents:euroCents(i.total)
 })));
 const keys=new Set<string>();for(const r of records){const k=r.allocation_source+':'+r.invoice_id;if(keys.has(k))throw Error('Duplicate income source');keys.add(k);}
 for(const a of s.income_allocations??[]){
  const project=a.project_id?s.projects.find(p=>p.id===a.project_id):null;
  if(a.year_id!==s.administration.id||!keys.has(a.source+':'+a.invoice_id)||(a.project_id&&(!project||project.property_id!==a.property_id)))throw Error('Invalid income allocation');
 }
 if(new Set((s.income_allocations??[]).map(a=>a.source+':'+a.invoice_id)).size!==(s.income_allocations??[]).length)throw Error('Duplicate income allocation');
 return records.map(r=>({...r,allocation:s.income_allocations?.find(a=>a.source===r.allocation_source&&a.invoice_id===r.invoice_id)}));
}
export type CostCenter={key:string;property_id:string|null;project_id:string|null;reviewed:number;pending:number;excluded:number;maintenance:number;renovation:number;invoiced:number;credit_notes:number};
export function costCenters(s:YearSource){
 const rows=new Map<string,CostCenter>();
 function row(property:string|null,project:string|null,unallocated=false){
  const key=unallocated?'unallocated':project?'project:'+project:property?'property:'+property:'entity';
  if(!rows.has(key))rows.set(key,{key,property_id:property,project_id:project,reviewed:0,pending:0,excluded:0,maintenance:0,renovation:0,invoiced:0,credit_notes:0});
  return rows.get(key)!;
 }
 for(const p of s.projects)row(p.property_id,p.id);
 const reviews=new Map(s.reviews.map(r=>[r.draft_id,r]));
 for(const c of s.costs){const r=reviews.get(c.id),category=r?.category??annualCategory(c.category),state=r?.review_status??'pending',entry=row(c.property_id,r?.project_id??null);entry[state]+=c.gross_cents;if(state!=='excluded'&&category==='maintenance')entry.maintenance+=c.gross_cents;if(state!=='excluded'&&['renovation','improvements'].includes(category))entry.renovation+=c.gross_cents;}
 for(const i of yearIncome(s)){const a=i.allocation;row(a?.property_id??null,a?.project_id??null,!a).invoiced+=i.gross_cents;}
 for(const c of s.sales.credit_notes??[]){if(!String(c.issued_on).startsWith(s.administration.fiscal_year+'-'))continue;
  if(c.issuer_id!==s.administration.issuer_id||!Number.isSafeInteger(c.gross_cents)||c.gross_cents<0)throw Error('Invalid credit source');
  const a=s.income_allocations?.find(a=>a.source==='services'&&a.invoice_id===c.invoice_id);
  row(a?.property_id??null,a?.project_id??null,!a).credit_notes+=c.gross_cents;
 }
 for(const r of rows.values())if([r.reviewed,r.pending,r.excluded,r.maintenance,r.renovation,r.invoiced,r.credit_notes].some(n=>!Number.isSafeInteger(n)))throw Error('Cost center totals exceed safe range');
 return [...rows.values()];
}
