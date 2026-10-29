import type {YearSource} from './administration';

/** Read-only cross-checks of recorded headers vs archived document metadata.
 * This does NOT parse or certify invoice PDF contents, and has NO supplier-payment journal.
 */
export type InvoiceIssue='archive_not_supplier_invoice'|'archive_date_differs'|'possible_double_entry';
export type InvoiceControlRow={
 draft_id:string;invoice_number:string;invoice_date:string;supplier_name:string;supplier_relationship_id:string;
 gross_cents:number;invoice_original_count:number;invoice_original_reviewed:boolean;
 archive_dates:string[];issues:InvoiceIssue[];
 payment_evidence_status:'not_reconciled_no_supplier_payment_ledger';
 content_verification:'manual_comparison_required';
};
const normalize=(value:string)=>value.normalize('NFKC').trim().toUpperCase().replace(/[\s._/-]+/g,'');
export function annualInvoiceControl(source:Pick<YearSource,'costs'>){
 const valid=source.costs;
 const buckets=new Map<string,typeof valid>();
 for(const c of valid){
  const number=normalize(c.supplier_invoice_number);
  // Only highly-specific matching references, exact date and amount count as candidates.
  // A short or generic number such as "1" is not persuasive duplicate evidence.
  if(number.length<6)continue;
  const key=[c.legal_entity_id,number,c.invoice_date,c.gross_cents].join('|');
  buckets.set(key,[...(buckets.get(key)??[]),c]);
 }
 const rows:InvoiceControlRow[]=valid.map(c=>{
  const docs=(c.archive_documents??[]).filter(d=>d.review_status!=='superseded');
  const invoiceOriginals=docs.filter(d=>d.category==='supplier_invoice');
  const archiveDates=invoiceOriginals.filter(d=>d.document_date).map(d=>d.document_date! as string);
  const issues:InvoiceIssue[]=[];
  if(docs.length>0&&invoiceOriginals.length===0)issues.push('archive_not_supplier_invoice');
  if(archiveDates.some(date=>date!==c.invoice_date))issues.push('archive_date_differs');
  const number=normalize(c.supplier_invoice_number);
  const key=[c.legal_entity_id,number,c.invoice_date,c.gross_cents].join('|');
  if(number.length>=6&&(buckets.get(key)??[]).some(o=>o.id!==c.id&&o.supplier_relationship_id!==c.supplier_relationship_id))
   issues.push('possible_double_entry');
  return {
   draft_id:c.id,invoice_number:c.supplier_invoice_number,invoice_date:c.invoice_date,
   supplier_name:c.supplier_name,supplier_relationship_id:c.supplier_relationship_id,
   gross_cents:c.gross_cents,invoice_original_count:invoiceOriginals.length,
   invoice_original_reviewed:invoiceOriginals.length>0&&invoiceOriginals.every(d=>d.review_status==='reviewed'),
   archive_dates:archiveDates,issues,
   payment_evidence_status:'not_reconciled_no_supplier_payment_ledger' as const,
   content_verification:'manual_comparison_required' as const
  };
 });
 return {
  rows,exceptions:rows.filter(row=>row.issues.length>0),
  classificationWarnings:rows.filter(row=>row.issues.includes('archive_not_supplier_invoice')).length,
  datedOriginalMismatches:rows.filter(row=>row.issues.includes('archive_date_differs')).length,
  possibleDoubleEntries:rows.filter(row=>row.issues.includes('possible_double_entry')).length,
  paymentReconciled:0,
  paymentVerificationAvailable:false as const
 };
}
