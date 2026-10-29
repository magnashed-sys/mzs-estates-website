import {NextRequest} from 'next/server';
import {requireContractAdmin} from '../../../../lib/security/estate-contracts';
import {capitalDealsEnabled} from '../../../../lib/security/capital-deals';
import {loadInvoiceRegister,invoiceFilters,selectInvoices} from '../../../../lib/finance/invoice-register';
import {readFinancialArchive} from '../../../../lib/finance/archive-register';
import {readRegister} from '../../../../lib/estates/read-register';
import {type Booking,type LoanDeal,type LoanInstalment,type LoanPayment} from '../../../../lib/finance/financial-cockpit';
import {buildFinancialPhase2,type AttributedLease,type AttributedPayment,type LeaseInvoice,type Issuer} from '../../../../lib/finance/financial-report';
import type {SupabaseClient} from '@supabase/supabase-js';

export const dynamic='force-dynamic';
const headers={'Cache-Control':'private, no-store'};
function madridToday(){
 const tokens=new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Madrid',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());
 const n=(key:string)=>tokens.find(p=>p.type===key)?.value??'';
 return n('year')+'-'+n('month')+'-'+n('day');
}
async function listBookings(db:SupabaseClient):Promise<Booking[]>{
 const rows:Booking[]=[];
 for(let offset=0;offset<100000;offset+=500){
  // Use the existing verified administrator RPC, not user-scoped booking SELECT.
  const {data,error}=await db.rpc('admin_list_rental_bookings',{}).order('id').range(offset,offset+499);
  if(error)throw new Error('Confirmed rental bookings could not be loaded');
  if(!data)throw new Error('Missing booking result');
  rows.push(...data as Booking[]);
  if(data.length<500)return rows;
 }
 throw new Error('Booking register too large for a complete total');
}
export async function GET(request:NextRequest){
 try{
  const {db}=await requireContractAdmin(); // Active authenticated Group Admin; fails closed.
  const today=madridToday(),currentYear=Number(today.slice(0,4));
  const requested=request.nextUrl.searchParams.get('year');
  const year=requested===null?currentYear:Number(requested);
  if(!Number.isInteger(year)||![2026,currentYear-1,currentYear,currentYear+1].includes(year))
   return Response.json({error:'Invalid reporting year'},{status:400,headers});
  const capitalOn=capitalDealsEnabled();
  const entityId=request.nextUrl.searchParams.get('entity')||'all';
  if(entityId!=='all'&&entityId!=='unassigned'&&!/^[a-f0-9-]{36}$/i.test(entityId))
   return Response.json({error:'Invalid entity filter'},{status:400,headers});
  const [contracts,rentPayments,bookings,deals,instalments,loanPayments,issuers,invoices,archiveInvoices,currentInvoices]=await Promise.all([
   readRegister(db,'mzs_lease_contracts'),
   readRegister(db,'mzs_lease_payments'),
   listBookings(db),
   capitalOn?readRegister(db,'mzs_capital_deals'):Promise.resolve([]),
   capitalOn?readRegister(db,'mzs_capital_instalments'):Promise.resolve([]),
   capitalOn?readRegister(db,'mzs_capital_payments'):Promise.resolve([]),
   readRegister(db,'mzs_lease_issuers'),
   readRegister(db,'mzs_lease_invoices'),
   readFinancialArchive(db,year),
   loadInvoiceRegister(db,year)
  ]);
  const result=buildFinancialPhase2({
   year,asOf:today,entityId,
   contracts:contracts as AttributedLease[],rentPayments:rentPayments as AttributedPayment[],
   bookings,deals:deals as LoanDeal[],instalments:instalments as LoanInstalment[],
   loanPayments:loanPayments as LoanPayment[],loansAvailable:capitalOn,
   issuers:issuers as Issuer[],invoices:invoices as LeaseInvoice[],archiveInvoices
  });
  const filters=invoiceFilters({year:String(year)});const chosen=entityId==='unassigned'?[]:currentInvoices.filter(i=>(year===2026||i.source!=='archive')&&(entityId==='all'||i.issuerId===entityId));
  return Response.json({...result,currentInvoices:selectInvoices(chosen,filters,today).totals},{headers});
 }catch{
  // Do not leak which private financial register exists or failed.
  return Response.json({error:'Financial overview is currently unavailable; no partial totals are shown.'},{status:503,headers});
 }
}
