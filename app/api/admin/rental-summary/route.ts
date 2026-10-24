import {requireContractAdmin} from '../../../../lib/security/estate-contracts';
import {readRegister} from '../../../../lib/estates/read-register';
import {cashflowSummary,rentalForecast} from '../../../../lib/estates/lease-cashflow';
export const dynamic='force-dynamic';
export async function GET(){
 const {db}=await requireContractAdmin();try{
 const [contracts,drafts,issued,payments]=await Promise.all(['mzs_lease_contracts','mzs_lease_invoice_drafts','mzs_lease_invoices','mzs_lease_payments'].map(t=>readRegister(db,t)));
 const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Amsterdam',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());const date=new Date(today+'T12:00:00Z');
 const forecast=Array.from({length:3},(_,i)=>{const month=new Date(Date.UTC(date.getUTCFullYear(),date.getUTCMonth()+i,1,12)).toISOString().slice(0,7);return {month,total:rentalForecast(contracts,month)}});
 return Response.json({...cashflowSummary(issued,payments,today),draftContracts:contracts.filter(c=>c.status==='draft').length,activeSchedules:contracts.filter(c=>c.status==='active').length,toReview:drafts.filter(d=>!issued.some(i=>i.draft_id===d.id)).length,endingSoon:contracts.filter(c=>c.status==='active'&&c.lease_end&&c.lease_end>=today&&c.lease_end<=new Date(date.getTime()+90*86400000).toISOString().slice(0,10)).length,forecast},{headers:{'Cache-Control':'private, no-store'}});
 }catch{return Response.json({error:'Rental summary unavailable'},{status:503});}
}
