import type {YearSource} from './administration';

/** Read-only evidence triage. No accounting, posting, payment or VAT conclusions. */
export type EvidenceIssue='missing_original'|'cost_pending_review'|'archive_pending_review';
export type EvidenceSource='private_archive'|'isolated_purchase_pdf'|'not_retained';
export type EvidenceRow={
 draft_id:string;invoice_number:string;invoice_date:string;supplier_name:string;
 property_name:string;gross_cents:number;cost_review_status:'pending'|'reviewed'|'excluded';
 source:EvidenceSource;archive_document_count:number;issues:EvidenceIssue[];
};
export function annualEvidenceReadiness(input:Pick<YearSource,'costs'|'reviews'>){
 const reviews=new Map(input.reviews.map(r=>[r.draft_id,r]));
 const rows:EvidenceRow[]=input.costs.map(c=>{
  const docs=c.archive_documents??[];
  // Only active, non-superseded private links are supplied by annualSource.
  const retained=docs.filter(d=>d.review_status!=='superseded');
  const scanned=c.source_document_status==='retained_purchase_pdf'&&
   typeof c.source_pdf_id==='string'&&c.source_pdf_id.length>0&&
   typeof c.source_pdf_sha256==='string'&&/^[a-f0-9]{64}$/.test(c.source_pdf_sha256);
  const source:EvidenceSource=retained.length?'private_archive':scanned?'isolated_purchase_pdf':'not_retained';
  const review=reviews.get(c.id)?.review_status??'pending',issues:EvidenceIssue[]=[];
  if(source==='not_retained')issues.push('missing_original');
  if(review==='pending')issues.push('cost_pending_review');
  if(retained.some(d=>d.review_status!=='reviewed'))issues.push('archive_pending_review');
  return {
   draft_id:c.id,invoice_number:c.supplier_invoice_number,invoice_date:c.invoice_date,
   supplier_name:c.supplier_name,property_name:c.property_name??'',
   gross_cents:c.gross_cents,cost_review_status:review,source,
   archive_document_count:retained.length,issues
  };
 });
 const unresolved=rows.filter(r=>r.issues.length).sort((a,b)=>
  Number(b.issues.includes('missing_original'))-Number(a.issues.includes('missing_original'))||
  Number(b.issues.includes('archive_pending_review'))-Number(a.issues.includes('archive_pending_review'))||
  a.invoice_date.localeCompare(b.invoice_date)||a.draft_id.localeCompare(b.draft_id)
 );
 return {
  rows,unresolved,
  total:rows.length,
  originalsRetained:rows.filter(r=>r.source!=='not_retained').length,
  missingOriginals:rows.filter(r=>r.source==='not_retained').length,
  pendingCostReview:rows.filter(r=>r.issues.includes('cost_pending_review')).length,
  pendingArchiveReview:rows.filter(r=>r.issues.includes('archive_pending_review')).length,
  unresolvedCount:unresolved.length
 };
}
