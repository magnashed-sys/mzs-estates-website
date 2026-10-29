import type {SupabaseClient} from '@supabase/supabase-js';
import {validateYearSource,type YearSource} from './administration';
import {documentLinks} from './document-links-data';
import {pdfIntakeEnvironment} from './pdf/model';
export async function annualSource(db:SupabaseClient,id:string):Promise<YearSource>{
 const {data,error}=await db.rpc('mzs_accountancy_year_source',{p_year:id});
 if(error||!data)throw Error('Annual administration unavailable');const source=validateYearSource(data,id);
 // Decisions are immutable and committed atomically with their purchase draft.
 // Production does not read staging-only tables.
 if(pdfIntakeEnvironment())for(let offset=0;offset<source.costs.length;offset+=100){
  const costs=source.costs.slice(offset,offset+100);
  const retained=await db.from('mzs_purchase_pdf_decisions').select('draft_id,intake_id,mzs_purchase_pdf_intakes(sha256)').eq('action','accepted').in('draft_id',costs.map(c=>c.id));
  if(retained.error)throw Error('Purchase source register unavailable');
  const records=new Map((retained.data??[]).map(d=>[d.draft_id,d]));
  for(const cost of costs){const record=records.get(cost.id);if(record){const intake=Array.isArray(record.mzs_purchase_pdf_intakes)?record.mzs_purchase_pdf_intakes[0]:record.mzs_purchase_pdf_intakes;if(!intake?.sha256)throw Error('Purchase source missing');cost.source_document_status='retained_purchase_pdf';cost.source_pdf_id=record.intake_id;cost.source_pdf_sha256=intake.sha256;}}
 }
 const links=await documentLinks(db,'cost',source.costs.map(c=>c.id));
 for(const cost of source.costs){
  cost.archive_documents=links.filter(l=>l.is_active&&l.draft_id===cost.id&&l.document.review_status!=='superseded').map(l=>({id:l.document.id,title:l.document.title,sha256:l.document.sha256,review_status:l.document.review_status,category:l.document.category,document_date:l.document.document_date}));
  if(cost.archive_documents.length&&cost.source_document_status==='missing')cost.source_document_status='retained_archive_pdf';
 }
 return source;
}
