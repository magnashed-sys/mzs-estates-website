/** Phase 2 reporting: only explicit invoice issuer IDs can attribute money to an entity.
 * Loan dossiers and holiday bookings currently have no entity FK: retain as Unassigned.
 * Read-only; no guessing from party names, property owners or free-text fields.
 */
import {buildFinancialCockpit, type Booking,type LeasePayment,type LoanDeal,type LoanInstalment,type LoanPayment,type CockpitData} from './financial-cockpit';
import {allocateInterestCredits} from '../capital/interest-allocation';
import type {ForecastContract} from '../estates/lease-cashflow';

export type AttributedLease = ForecastContract & {id:string;issuer_id:string|null};
export type Issuer = {id:string;name:string;kind?:string|null;source_company_id?:string|null};
export type LeaseInvoice = {id:string;contract_id:string;issuer_id:string|null;total:number|string;due_date:string};
export type AttributedPayment = LeasePayment & {invoice_id:string};
export type FinancialEntity = {id:string;name:string;kind:string;contracts:number;source:'invoice_issuer'|'unassigned'};
export type HistoricalInvoice = {
 id:string;issuer_id:string;number:string;issued_on:string;
 net_cents:number|string;gross_cents:number|string;source_paid_cents:number|string;source_open_cents:number|string;
};
export type HistoricalMonth = {month:string;count:number;netCents:number;grossCents:number;paidCents:number;openCents:number;credits:number};
export type FinancialPhase2 = CockpitData & {
  currentInvoices?:{count:number;gross:number;paid:number;outstanding:number;overdue:number;unknown:number;unknownGross:number;credits:number};
  historical:{enabled:boolean;rows:HistoricalMonth[];totals:Omit<HistoricalMonth,'month'>};
  entityId:string;entities:FinancialEntity[];
  report:{expectedNet:number;recordedNet:number;outstandingRent:number;overdueRent:number;
    overdueLoanReceivables:number;overdueLoanPayables:number;unassignedContracts:number;
    loanAttributionPending:number;bookingAttributionPending:number};
};
function cents(value:number|string):number{
 const n=Number(value);if(!Number.isFinite(n)||n<0)throw new Error('Invalid financial register amount');
 return Math.round(n*100);
}
export function buildFinancialPhase2(args:{
  year:number;asOf:string;entityId:string;contracts:AttributedLease[];issuers:Issuer[];
  invoices:LeaseInvoice[];rentPayments:AttributedPayment[];deals:LoanDeal[];
  instalments:LoanInstalment[];loanPayments:LoanPayment[];bookings:Booking[];loansAvailable:boolean;archiveInvoices?:HistoricalInvoice[];
}):FinancialPhase2{
 const {year,asOf,entityId,contracts,issuers,invoices,rentPayments,deals,instalments,loanPayments,bookings,loansAvailable}=args;
 const registry=new Map(issuers.map(x=>[x.id,x]));
 if(registry.size!==issuers.length)throw new Error('Duplicate entity identifier');
 const sourceId=(id:string|null|undefined)=>id&&registry.has(id)?id:'unassigned';
 const countByEntity=new Map<string,number>();
 for(const c of contracts)if(c.status==='active'){
  const id=sourceId(c.issuer_id);countByEntity.set(id,(countByEntity.get(id)||0)+1);
 }
 const entities:FinancialEntity[]=[
  ...issuers.map(x=>({id:x.id,name:x.name,kind:x.kind||'company',contracts:countByEntity.get(x.id)||0,source:'invoice_issuer' as const})),
  {id:'unassigned',name:'Unassigned / not linked',kind:'unassigned',contracts:countByEntity.get('unassigned')||0,source:'unassigned' as const}
 ];
 if(entityId!=='all'&&!entities.some(x=>x.id===entityId))throw new Error('Unknown financial entity filter');
 const matches=(id:string|null|undefined)=>entityId==='all'||sourceId(id)===entityId;
 const chosenContracts=contracts.filter(x=>matches(x.issuer_id));
 const invoiceMap=new Map(invoices.map(x=>[x.id,x]));
 if(invoiceMap.size!==invoices.length)throw new Error('Duplicate invoice identifier');
 const chosenInvoices=invoices.filter(x=>matches(x.issuer_id));
 // Invoice issuer_id is a historical accounting snapshot. Never fall back to a
 // changed contract issuer; otherwise receipts could silently move between entities.
 const chosenPayments=rentPayments.filter(p=>matches(invoiceMap.get(p.invoice_id)?.issuer_id));
 // Loan reporting entity is assigned explicitly in each loan dossier; booking data remains unassigned.
 const groupUnassigned=entityId==='all'||entityId==='unassigned';
 const chosenDeals=deals.filter(d=>entityId==='all'||sourceId(d.entity_id)===entityId);
 const chosenDealIds=new Set(chosenDeals.map(d=>d.id));
 const chosenInstalments=instalments.filter(i=>chosenDealIds.has(i.deal_id));
 const chosenTermIds=new Set(chosenInstalments.map(i=>i.id));
 const chosenLoanPayments=loanPayments.filter(p=>chosenTermIds.has(p.instalment_id));
 const chosenBookings=groupUnassigned?bookings:[];
 const base=buildFinancialCockpit({
  year,asOf,contracts:chosenContracts,rentPayments:chosenPayments,
  deals:chosenDeals,instalments:chosenInstalments,
  loanPayments:chosenLoanPayments,bookings:chosenBookings,loansAvailable
 });
 let outstanding=0,overdue=0;
 const paymentsByInvoice=new Map<string,number>();
 for(const p of rentPayments)if(!p.reversed_at){
  paymentsByInvoice.set(p.invoice_id,(paymentsByInvoice.get(p.invoice_id)||0)+cents(p.amount));
 }
 for(const invoice of chosenInvoices){
  const rest=Math.max(0,cents(invoice.total)-(paymentsByInvoice.get(invoice.id)||0));
  outstanding+=rest;if(invoice.due_date<asOf)overdue+=rest;
 }
 const paidTermIds=new Set(chosenLoanPayments.filter(p=>!p.is_void).map(p=>p.instalment_id));
 const alreadyReceivingDeals=new Set(chosenInstalments.filter(i=>i.kind==='interest'&&paidTermIds.has(i.id)).map(i=>i.deal_id));
 const dealById=new Map(chosenDeals.filter(d=>d.status==='active'||(d.status==='agreed'&&alreadyReceivingDeals.has(d.id))).map(d=>[d.id,d]));
 const byLoan=new Map<string,ReturnType<typeof allocateInterestCredits>>();
 for(const [id] of dealById){
  const loanTerms=chosenInstalments.filter(i=>i.deal_id===id);
  const loanTermIds=new Set(loanTerms.map(t=>t.id));
  const loanCash=chosenLoanPayments.filter(p=>loanTermIds.has(p.instalment_id));
  byLoan.set(id,allocateInterestCredits(loanTerms,loanCash));
 }
 let dueIncome=0,dueCost=0;
 for(const item of chosenInstalments){
  if(item.kind!=='interest'||item.due_date>=asOf)continue;
  const deal=dealById.get(item.deal_id);if(!deal)continue;
  const remaining=byLoan.get(item.deal_id)?.byId.get(item.id)?.remaining;
  if(remaining===undefined)throw new Error('Missing interest allocation');
  const due=Math.round(remaining*100);
  if(deal.direction==='provided')dueIncome+=due;else dueCost+=due;
 }
 const historical=buildHistoricalInvoices(year,(args.archiveInvoices??[]).filter(x=>matches(x.issuer_id)));
 const total=(key:keyof CockpitData['rows'][number])=>base.rows.reduce((s,x)=>s+Number(x[key]),0);
 return {...base,entityId,entities,historical,report:{
  expectedNet:Math.round((total('rentForecast')+total('interestIn')-total('interestOut'))*100)/100,
  recordedNet:Math.round((total('rentReceived')+total('interestReceived')-total('interestPaid'))*100)/100,
  outstandingRent:outstanding/100,overdueRent:overdue/100,
  overdueLoanReceivables:dueIncome/100,overdueLoanPayables:dueCost/100,
  unassignedContracts:countByEntity.get('unassigned')||0,
  loanAttributionPending:loansAvailable?deals.filter(x=>(x.status==='active'||x.status==='agreed')&&!x.entity_id).length:0,
  bookingAttributionPending:bookings.filter(x=>x.status==='confirmed'&&!x.is_test).length
 }};
}

/** Invoice-date reporting only: source settlements have no payment dates.
 * These amounts must never be added to forecast or cash-receipt series. */
export function buildHistoricalInvoices(year:number,invoices:HistoricalInvoice[]):FinancialPhase2['historical']{
 const enabled=year===2026;
 const empty=()=>({count:0,netCents:0,grossCents:0,paidCents:0,openCents:0,credits:0});
 const rows=Array.from({length:12},(_,i)=>({month:year+'-'+String(i+1).padStart(2,'0'),...empty()}));
 const totals=empty(),seen=new Set<string>(),numbers=new Set<string>();
 const exact=(value:number|string)=>{
  if((typeof value!=='number'&&typeof value!=='string')||! /^-?\d+$/.test(String(value)))throw new Error('Invalid historical invoice amount');
  const n=Number(value);if(!Number.isSafeInteger(n))throw new Error('Invalid historical invoice amount');return n;
 };
 if(enabled)for(const invoice of invoices){
  if(!/^\d{4}-\d{2}-\d{2}$/.test(invoice.issued_on)||new Date(invoice.issued_on+'T00:00:00Z').toISOString().slice(0,10)!==invoice.issued_on)throw new Error('Invalid historical invoice date');
  if(Number(invoice.issued_on.slice(0,4))!==year)continue;
  const key=invoice.issuer_id+':'+invoice.number.toUpperCase();
  if(!invoice.id||!invoice.issuer_id||!invoice.number||seen.has(invoice.id)||numbers.has(key))throw new Error('Duplicate or incomplete historical invoice');
  seen.add(invoice.id);numbers.add(key);
  const row=rows.find(r=>r.month===invoice.issued_on.slice(0,7));if(!row)throw new Error('Invalid historical invoice month');
  const netCents=exact(invoice.net_cents),grossCents=exact(invoice.gross_cents),paidCents=exact(invoice.source_paid_cents),openCents=exact(invoice.source_open_cents);
  if(grossCents!==paidCents+openCents)throw new Error('Historical invoice balance mismatch');
  const values={count:1,netCents,grossCents,paidCents,openCents,credits:grossCents<0?1:0};
  for(const key of Object.keys(values) as (keyof typeof values)[]){
   row[key]+=values[key];totals[key]+=values[key];
   if(!Number.isSafeInteger(totals[key]))throw new Error('Historical invoice total exceeds safe range');
  }
 }
 return {enabled,rows,totals};
}
