import {ADMINISTRATION_ROOT,checkLabels,type YearSource} from './administration';
import {annualEvidenceReadiness} from './annual-evidence';
import {annualInvoiceControl} from './invoice-control';
import {supplierCostIntegrity,type SupplierIdentity} from './supplier-integrity';
import {attachmentHref} from './document-links';
export type CompletenessItem={id:string;group:'documents'|'review'|'suppliers';label:string;issues:string[];href:string};
export function completenessItems(source:YearSource,suppliers:SupplierIdentity[]):CompletenessItem[]{
 const root=ADMINISTRATION_ROOT+'/'+source.administration.id,items:CompletenessItem[]=[];
 const invoices=new Map(annualInvoiceControl(source).rows.map(r=>[r.draft_id,r]));
 for(const row of annualEvidenceReadiness(source).rows){
  const issues=[...row.issues,...(invoices.get(row.draft_id)?.issues??[])];
  if(issues.length)items.push({id:'cost:'+row.draft_id,group:issues.includes('missing_original')?'documents':'review',label:row.invoice_number+' · '+row.supplier_name,issues,href:issues.includes('missing_original')?attachmentHref('cost',row.draft_id):root+'?draft='+row.draft_id+'#costs'});
 }
 const seen=new Set<string>();
 for(const row of supplierCostIntegrity(source.costs,suppliers).signals){
  if(seen.has(row.supplier_id))continue;seen.add(row.supplier_id);
  const issues=[...(row.missing_record?['supplier_unavailable']:[]),...(row.missing_company_tax_id?['tax_id_check']:[]),...(row.possible_duplicate_records.length?['supplier_duplicate_check']:[])];
  if(issues.length)items.push({id:'supplier:'+row.supplier_id,group:'suppliers',label:row.supplier_name||row.supplier_id,issues,href:'/admin/relationships'});
 }
 for(const d of source.documents)if(!['reviewed','superseded'].includes(d.review_status))items.push({id:'document:'+d.id,group:'documents',label:d.title,issues:['archive_pending_review'],href:'/admin/workspaces/accountancy/documents/'+d.id});
 for(const key of Object.keys(checkLabels) as (keyof typeof checkLabels)[])if(key!=='bank'&&!source.administration.checks[key])items.push({id:'check:'+key,group:'review',label:checkLabels[key],issues:['checklist_pending'],href:root});
 return items.sort((a,b)=>Number(b.issues.includes('missing_original'))-Number(a.issues.includes('missing_original'))||a.id.localeCompare(b.id));
}
export const completenessLabels:Record<string,[string,string]>={missing_original:['Original PDF missing','Falta el PDF original'],cost_pending_review:['Cost awaiting review','Coste pendiente de revisión'],archive_pending_review:['Archived PDF awaiting review','PDF archivado pendiente de revisión'],archive_not_supplier_invoice:['Check document classification','Comprobar clasificación documental'],archive_date_differs:['Check invoice and document dates','Comprobar fechas de factura y documento'],possible_double_entry:['Possible duplicate invoice — verify','Posible factura duplicada: verificar'],supplier_unavailable:['Supplier record unavailable','Registro del proveedor no disponible'],tax_id_check:['Company tax ID to check where applicable','Comprobar identificador fiscal cuando proceda'],supplier_duplicate_check:['Possible duplicate supplier — verify','Posible proveedor duplicado: verificar'],checklist_pending:['Annual checklist section not reviewed','Sección anual pendiente de revisión']};
