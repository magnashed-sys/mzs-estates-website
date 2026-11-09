import {yearIncome} from './cost-centers';
import {annualCategory,type YearSource} from './administration';

/** Reporting presentation, not a posting engine, tax return or income statement.
 * Values are original invoice / purchase-concept GROSS cents, including source VAT.
 * The same source is counted once per entity-year, by its original document date.
 * Only explicit income allocations may attribute revenue to a property/project.
 */
export type PropertyFinanceTotals={
 invoiceCount:number;creditCount:number;costCount:number;
 invoicedGross:number;creditsGross:number;
 reviewedCostGross:number;pendingCostGross:number;excludedCostGross:number;
 maintenanceGross:number;renovationGross:number;
 unallocatedInvoiceCount:number;unallocatedIncomeGross:number;
};
export type PropertyFinanceMonth={month:string}&PropertyFinanceTotals;
export type PropertyFinanceScope={propertyId?:string;projectId?:string};
const empty=():PropertyFinanceTotals=>({
 invoiceCount:0,creditCount:0,costCount:0,
 invoicedGross:0,creditsGross:0,reviewedCostGross:0,pendingCostGross:0,excludedCostGross:0,
 maintenanceGross:0,renovationGross:0,unallocatedInvoiceCount:0,unallocatedIncomeGross:0,
});
const safeAmount=(value:number)=>{
 if(!Number.isSafeInteger(value)||value<0)throw Error('Unverified source amount');
 return value;
};
const add=(target:PropertyFinanceTotals,key:keyof PropertyFinanceTotals,amount:number)=>{
 const next=target[key]+amount;
 if(!Number.isSafeInteger(next))throw Error('Financial reporting total exceeds safe range');
 target[key]=next;
};
const monthKey=(date:string,year:number)=>{
 if(!new RegExp('^'+year+'-(0[1-9]|1[0-2])-[0-3][0-9]$').test(date))throw Error('Source date falls outside fiscal year');
 const day=new Date(date+'T12:00:00Z');
 if(Number.isNaN(day.getTime())||day.toISOString().slice(0,10)!==date)throw Error('Invalid source date');
 return date.slice(0,7);
};
export function propertyFinancialReport(source:YearSource,scope:PropertyFinanceScope={}){
 const year=source.administration.fiscal_year;
 const projects=new Map(source.projects.map(p=>[p.id,p]));
 if(projects.size!==source.projects.length)throw Error('Duplicate project identity');
 if(scope.projectId&&!projects.has(scope.projectId))throw Error('Unknown project');
 if(scope.projectId&&scope.propertyId&&projects.get(scope.projectId)?.property_id!==scope.propertyId)throw Error('Project outside selected property');
 const months=Array.from({length:12},(_,i)=>({month:year+'-'+String(i+1).padStart(2,'0'),...empty()}));
 const byMonth=new Map(months.map(x=>[x.month,x]));
 const totals=empty(),reviewMap=new Map(source.reviews.map(r=>[r.draft_id,r]));
 if(reviewMap.size!==source.reviews.length)throw Error('Duplicate cost review');
 const allIncome=yearIncome(source);
 const invoiceMap=new Map(allIncome.filter(i=>i.allocation_source==='services').map(i=>[i.invoice_id,i]));
 const seenInvoices=new Set<string>(),seenCosts=new Set<string>(),seenCredits=new Set<string>();
 const matches=(propertyId:string|null|undefined,projectId:string|null|undefined)=>
    (!scope.propertyId||propertyId===scope.propertyId)&&
    (!scope.projectId||projectId===scope.projectId);
 const apply=(date:string,key:keyof PropertyFinanceTotals,cents:number)=>{
  const month=byMonth.get(monthKey(date,year));
  if(!month)throw Error('Missing report month');
  add(month,key,cents);add(totals,key,cents);
 };
 for(const record of allIncome){
  const key=record.allocation_source+':'+record.invoice_id;
  if(seenInvoices.has(key))throw Error('Duplicated issued invoice');seenInvoices.add(key);
  if(record.allocation?.project_id){
   const p=projects.get(record.allocation.project_id);
   if(!p||p.property_id!==record.allocation.property_id)throw Error('Inconsistent invoice project');
  }
  const explicitlyAllocated=Boolean(record.allocation);
  // For the complete entity report, unknown allocations are visible but never
  // silently attributed to a property.
  if(!matches(record.allocation?.property_id,record.allocation?.project_id))continue;
  const gross=safeAmount(record.gross_cents);
  apply(record.invoice_date,'invoicedGross',gross);
  apply(record.invoice_date,'invoiceCount',1);
  if(!explicitlyAllocated){
   apply(record.invoice_date,'unallocatedInvoiceCount',1);
   apply(record.invoice_date,'unallocatedIncomeGross',gross);
  }
 }
 const credits=source.sales.credit_notes??[];
 if(!Array.isArray(credits))throw Error('Invalid credit-note register');
 for(const note of credits){
  const n=note as {id?:string;invoice_id:string;issuer_id:string;issued_on:string;gross_cents:number};
  if(n.issuer_id!==source.administration.issuer_id)throw Error('Credit note outside issuer');
  if(!n.issued_on.startsWith(year+'-'))continue;
  if(!n.id||seenCredits.has(n.id))throw Error('Duplicate credit note');
  seenCredits.add(n.id);
  const original=invoiceMap.get(n.invoice_id),allocation=original?.allocation;
  if(!matches(allocation?.property_id,allocation?.project_id))continue;
  apply(n.issued_on,'creditsGross',safeAmount(n.gross_cents));
  apply(n.issued_on,'creditCount',1);
 }
 for(const cost of source.costs){
  if(seenCosts.has(cost.id))throw Error('Duplicate supplier cost');
  seenCosts.add(cost.id);
  const review=reviewMap.get(cost.id);
  const projectId=review?.project_id??null;
  const p=projectId?projects.get(projectId):null;
  if(projectId&&(!p||p.property_id!==cost.property_id))throw Error('Inconsistent cost project');
  if(!matches(cost.property_id,projectId))continue;
  const gross=safeAmount(cost.gross_cents);
  const status=review?.review_status??'pending';
  if(!['reviewed','pending','excluded'].includes(status))throw Error('Invalid source review status');
  const category=review?.category??annualCategory(cost.category);
  apply(cost.invoice_date,'costCount',1);
  apply(cost.invoice_date,status==='reviewed'?'reviewedCostGross':status==='pending'?'pendingCostGross':'excludedCostGross',gross);
  if(status!=='excluded'){
   if(category==='maintenance')apply(cost.invoice_date,'maintenanceGross',gross);
   if(category==='renovation'||category==='improvements')apply(cost.invoice_date,'renovationGross',gross);
  }
 }
 return {year,scope,totals,months};
}
