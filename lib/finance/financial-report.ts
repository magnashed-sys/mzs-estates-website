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
export type FinancialPhase2 = CockpitData & {
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
  instalments:LoanInstalment[];loanPayments:LoanPayment[];bookings:Booking[];loansAvailable:boolean;
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
 const total=(key:keyof CockpitData['rows'][number])=>base.rows.reduce((s,x)=>s+Number(x[key]),0);
 return {...base,entityId,entities,report:{
  expectedNet:Math.round((total('rentForecast')+total('interestIn')-total('interestOut'))*100)/100,
  recordedNet:Math.round((total('rentReceived')+total('interestReceived')-total('interestPaid'))*100)/100,
  outstandingRent:outstanding/100,overdueRent:overdue/100,
  overdueLoanReceivables:dueIncome/100,overdueLoanPayables:dueCost/100,
  unassignedContracts:countByEntity.get('unassigned')||0,
  loanAttributionPending:loansAvailable?deals.filter(x=>(x.status==='active'||x.status==='agreed')&&!x.entity_id).length:0,
  bookingAttributionPending:bookings.filter(x=>x.status==='confirmed'&&!x.is_test).length
 }};
}
