import {NextRequest} from 'next/server';
import {requireEstateAdmin} from '../../../../../../lib/security/estate-properties';
import {operationsDay} from '../../../../../../lib/property-operations/action-queues';
import {invoiceFilters,loadInvoiceRegister,selectInvoices,invoiceRegisterCsv} from '../../../../../../lib/finance/invoice-register';
export const dynamic='force-dynamic';
const headers={'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','X-Robots-Tag':'noindex, nofollow'};
export async function GET(request:NextRequest){
 const {db}=await requireEstateAdmin();
 const params:Record<string,string|string[]>={};for(const [k,v] of new URL(request.url).searchParams){const prior=params[k];params[k]=prior===undefined?v:Array.isArray(prior)?[...prior,v]:[prior,v];}
 let filters;try{filters=invoiceFilters(params);}catch{return new Response('Invalid invoice filters',{status:400,headers});}
 try{const today=operationsDay(),all=await loadInvoiceRegister(db,filters.year),{rows}=selectInvoices(all,filters,today);return new Response(invoiceRegisterCsv(rows,today),{headers:{...headers,'Content-Type':'text/csv; charset=utf-8','Content-Disposition':'attachment; filename="MZS-Invoices-'+(filters.year??'all-years')+'.csv"'}});}catch{return new Response('The complete invoice selection could not be verified. No export was created.',{status:503,headers});}
}
