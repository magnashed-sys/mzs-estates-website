import {NextRequest} from 'next/server';
import {requireEstateAdmin} from '../../../../../../lib/security/estate-properties';
import {annualSource} from '../../../../../../lib/accountancy/administration-data';
import {propertyFinancialReport} from '../../../../../../lib/accountancy/property-financial-report';
import {accountantCsv} from '../../../../../../lib/property-operations/finance';
import {uuid} from '../../../../../../lib/accountancy/administration';

export const dynamic='force-dynamic';
const headers={'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'};
const money=(cents:number)=>(cents/100).toFixed(2);

export async function GET(request:NextRequest){
 const {db}=await requireEstateAdmin();
 const q=request.nextUrl.searchParams;
 const yearId=q.get('administration')??'';
 const propertyId=q.get('property')??'';
 const projectId=q.get('project')??'';
 if(!uuid.test(yearId)||(propertyId&&!uuid.test(propertyId))||(projectId&&!uuid.test(projectId)))
  return Response.json({error:'Invalid report selection'},{status:400,headers});
 try{
  const {data:year,error}=await db.from('mzs_accountancy_years')
   .select('id,issuer_id,fiscal_year').eq('id',yearId).maybeSingle();
  if(error||!year)return Response.json({error:'Administration not found'},{status:404,headers});
  if(propertyId){
   const {data,error:propertyError}=await db.from('mzs_estate_properties').select('id').eq('id',propertyId).maybeSingle();
   if(propertyError||!data)return Response.json({error:'Property not found'},{status:404,headers});
  }
  const source=await annualSource(db,yearId);
  if(projectId&&!source.projects.some(p=>p.id===projectId))
   return Response.json({error:'Project not found'},{status:404,headers});
  const report=propertyFinancialReport(source,{propertyId:propertyId||undefined,projectId:projectId||undefined});
  const fields=['period','issuer_id','fiscal_year','property_id','project_id','issued_invoices_gross_eur',
   'credit_notes_gross_eur','reviewed_purchase_concepts_gross_eur','pending_purchase_concepts_gross_eur',
   'excluded_purchase_concepts_gross_eur','maintenance_concepts_gross_eur',
   'renovation_concepts_gross_eur','income_awaiting_allocation_gross_eur','issued_invoice_count',
   'credit_count','purchase_concept_count'];
  const rows=[...report.months,{month:'ANNUAL_TOTAL',...report.totals}].map(row=>({
   period:row.month,issuer_id:year.issuer_id,fiscal_year:year.fiscal_year,
   property_id:propertyId,project_id:projectId,
   issued_invoices_gross_eur:money(row.invoicedGross),
   credit_notes_gross_eur:money(row.creditsGross),
   reviewed_purchase_concepts_gross_eur:money(row.reviewedCostGross),
   pending_purchase_concepts_gross_eur:money(row.pendingCostGross),
   excluded_purchase_concepts_gross_eur:money(row.excludedCostGross),
   maintenance_concepts_gross_eur:money(row.maintenanceGross),
   renovation_concepts_gross_eur:money(row.renovationGross),
   income_awaiting_allocation_gross_eur:money(row.unallocatedIncomeGross),
   issued_invoice_count:row.invoiceCount,credit_count:row.creditCount,
   purchase_concept_count:row.costCount
  }));
  const csv=accountantCsv(fields,rows);
  const scope=projectId?'project':propertyId?'property':'entity';
  return new Response(csv,{headers:{...headers,'Content-Type':'text/csv; charset=utf-8',
   'Content-Disposition':'attachment; filename="mzs-property-finance-'+year.fiscal_year+'-'+scope+'-'+yearId.slice(0,8)+'.csv"'}});
 }catch{
  return Response.json({error:'The verified financial source is unavailable. No partial report exported.'},{status:503,headers});
 }
}
