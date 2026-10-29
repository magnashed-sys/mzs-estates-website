import {accountantCsv} from '../property-operations/finance';
import {exportBytes,exportHash,type ArchiveFile} from '../property-operations/accountant-archive';
import {salesAccountantFiles} from './sales-package';
import {validateYearSource,annualSummary,annualCategory,checkLabels,type YearSource} from './administration';
import {annualEvidenceReadiness} from './annual-evidence';
/** A collection package, not an automatically posted annual ledger or tax computation. */
export function yearAccountantFiles(input:YearSource,id:string):ArchiveFile[]{
 const s=validateYearSource(input,id),y=s.administration,summary=annualSummary(s),evidence=annualEvidenceReadiness(s),reviews=new Map(s.reviews.map(r=>[r.draft_id,r]));
 const files=salesAccountantFiles(s.sales,y.issuer_id,y.fiscal_year).map(f=>({...f,name:'sales/'+f.name}));
 function csv(name:string,fields:string[],rows:Record<string,unknown>[]){files.push({name,bytes:exportBytes(accountantCsv(fields,rows))});}
 const costs=s.costs.map(c=>{const r=reviews.get(c.id),project=s.projects.find(p=>p.id===r?.project_id);return {...c,source_pdf_id:c.source_pdf_id??'',source_pdf_sha256:c.source_pdf_sha256??'',net_eur:(c.net_cents/100).toFixed(2),original_vat_eur:(c.vat_cents/100).toFixed(2),gross_eur:(c.gross_cents/100).toFixed(2),annual_category:r?.category??annualCategory(c.category),review_status:r?.review_status??'pending',reviewed_at:r?.updated_at??'',project_id:project?.id??'',project_name:project?.name??'',evidence_reference:r?.evidence_reference??'',review_note:r?.note??'',allocations_json:JSON.stringify(c.allocations),accounting_posted:false};});
 csv('supplier-costs.csv',['id','legal_entity_id','supplier_relationship_id','supplier_name','supplier_invoice_number','invoice_date','cost_scope','property_id','property_name','category','annual_category','project_id','project_name','description','net_eur','original_vat_eur','gross_eur','review_status','reviewed_at','evidence_reference','review_note','source_document_status','source_pdf_id','source_pdf_sha256','accounting_posted','allocations_json'],costs);
 csv('supplier-document-links.csv',['draft_id','document_id','title','sha256','review_status'],s.costs.flatMap(c=>(c.archive_documents??[]).map(d=>({draft_id:c.id,document_id:d.id,title:d.title,sha256:d.sha256,review_status:d.review_status}))));
 // Complete source-evidence reconciliation, including clean rows. This is a review aid, never a payment or VAT assertion.
 csv('supplier-evidence-actions.csv',
 ['draft_id','supplier_invoice_number','invoice_date','supplier_name','property_name','gross_eur','cost_review_status','source','archive_document_count','original_missing','cost_pending_review','archive_pending_review','issue_codes','accounting_posted','payment_verified'],
 evidence.rows.map(row=>({
  draft_id:row.draft_id,supplier_invoice_number:row.invoice_number,invoice_date:row.invoice_date,
  supplier_name:row.supplier_name,property_name:row.property_name,gross_eur:(row.gross_cents/100).toFixed(2),
  cost_review_status:row.cost_review_status,source:row.source,archive_document_count:row.archive_document_count,
  original_missing:row.issues.includes('missing_original'),
  cost_pending_review:row.issues.includes('cost_pending_review'),
  archive_pending_review:row.issues.includes('archive_pending_review'),
  issue_codes:row.issues.join(';'),accounting_posted:false,payment_verified:'not_assessed'
 })));
 csv('cost-category-summary.csv',['category','reviewed_gross_eur','pending_gross_eur','excluded_gross_eur','record_count'],summary.categories.map(c=>({category:c.key,reviewed_gross_eur:(c.reviewedGross/100).toFixed(2),pending_gross_eur:(c.pendingGross/100).toFixed(2),excluded_gross_eur:(c.excludedGross/100).toFixed(2),record_count:c.count})));
 csv('projects.csv',['id','year_id','name','kind','property_id','source_reference'],s.projects);
 csv('source-document-index.csv',['id','issuer_id','fiscal_year','title','original_name','category','review_status','sha256','notes','updated_at'],s.documents);
 const imported=s.sales.imported as Record<string,any>[];
 // All historical references are retained. No historical paid snapshot is turned into cashflow.
 csv('historical-invoice-snapshots.csv',['id','issuer_id','number','issued_on','gross_cents','source_paid_cents','source_open_cents','excluded','treatment'],imported.filter(i=>String(i.issued_on).startsWith(y.fiscal_year+'-')).map(i=>({...i,treatment:'historical_reference_only_check_overlap_with_issued_sales'})));
 csv('capital-register-context-all-periods.csv',['id','entity_id','title','direction','lender','borrower','principal','annual_rate','currency','agreement_date','start_date','maturity_date','status','review_state','source_reference','notes'],s.capital_references);
 csv('year-checklist.csv',['section','reviewed','last_settings_saved_at','meaning'],Object.keys(checkLabels).map(k=>({section:k,reviewed:y.checks[k as keyof typeof checkLabels],last_settings_saved_at:y.updated_at,meaning:'manual_collection_review_not_statutory_signoff'})));
 const exceptions:Record<string,unknown>[]=[];
 for(const c of costs){if(c.review_status!=='reviewed')exceptions.push({source:'supplier_cost',id:c.id,reason:c.review_status==='excluded'?'excluded_with_reason':'pending_review',detail:c.review_note});if(c.source_document_status==='missing')exceptions.push({source:'supplier_cost',id:c.id,reason:'original_document_not_attached',detail:c.evidence_reference});}
 for(const d of s.documents)if(d.review_status!=='reviewed')exceptions.push({source:'document',id:d.id,reason:d.review_status,detail:d.title});
 for(const k of Object.keys(checkLabels))if(!y.checks[k as keyof typeof checkLabels])exceptions.push({source:'checklist',id:k,reason:'not_reviewed',detail:''});
 if(y.vat_treatment==='pending')exceptions.push({source:'tax',id:y.id,reason:'vat_treatment_unconfirmed',detail:y.vat_evidence});
 csv('annual-review-exceptions.csv',['source','id','reason','detail'],exceptions);
 csv('source-coverage.csv',['source','scope','limitation'],[
  {source:'issued_sales_credit_notes_receipts',scope:'entity; invoice or event year; sales/ subfolder',limitation:'see sales/README.txt; undated receipts remain exceptions'},
  {source:'supplier_costs',scope:'entity; supplier invoice year; all review statuses',limitation:'original immutable concepts; gross totals are not deductible expense calculations; no purchase payments inferred'},
  {source:'historical_invoices',scope:'entity; original issue year; reference snapshots',limitation:'may overlap issued sales; original paid amounts are not bank events; exclusions retained'},
  {source:'documents',scope:'entity and financial year; index and checksums',limitation:'original private PDF bytes are not included; request via the document archive'},
  {source:'supplier_evidence_actions',scope:'entity, supplier invoice year and original review',limitation:'source/action indicators only; not proof of bank payment, VAT recovery or statutory completion'},
  {source:'capital',scope:'all current register references for entity, all periods',limitation:'context only; not annual balances, interest accruals, repayments or confirmations'},
  {source:'bank_assets_staff_and_tax_adjustments',scope:'manual collection checklist',limitation:'not a bank ledger or asset register; staff statements without verified entity attribution, unissued bookings, opening balances and fiscal adjustments are not added to annual amounts'}
 ]);
 files.push({name:'administration-settings.json',bytes:exportBytes(JSON.stringify(y,null,2)+'\n')});
 files.push({name:'README.txt',bytes:exportBytes([
  'MZS ANNUAL ADMINISTRATION — COLLECTION PACKAGE / DOSSIER ANUAL',
  'Entity / Entidad: '+s.sales.issuer.name+' ('+y.issuer_id+')','Year / Ejercicio: '+y.fiscal_year,'Snapshot / Instantánea: '+s.snapshot_at,
  'EN: This package gathers platform sources for the local accountant. It is not a trial balance, statutory annual account, tax filing or confirmation that all transactions are present.',
  'ES: Este dossier reúne fuentes de la plataforma para el asesor local. No es un balance de comprobación, unas cuentas anuales, una declaración fiscal ni una confirmación de integridad.',
  'EN: Read source-coverage.csv, supplier-evidence-actions.csv and both exception files first. Reviewed, pending and excluded costs remain separate. Original net, VAT and gross amounts are retained. No VAT recovery, capitalisation or depreciation is calculated.',
  'ES: Revise primero source-coverage.csv, supplier-evidence-actions.csv y los archivos de incidencias. Los costes revisados, pendientes y excluidos están separados. Se conservan los importes netos, IVA e importes brutos originales. No se calcula deducción de IVA, capitalización ni amortización.',
  'EN: Historical invoice snapshots and capital references are context. Do not add them to issued sales or annual financing balances without reconciliation. Recorded receipt events can relate to invoices from a different year; reversal is not proof of a bank refund.',
  'ES: Las facturas históricas y las referencias de financiación son contexto. No las sume a las ventas emitidas ni a los saldos anuales sin conciliación. Los cobros pueden corresponder a facturas de otro ejercicio; una anulación no acredita un reembolso bancario.',
  'EN: Checklist ticks record the last manual review. Recheck after source changes. No record is posted, paid, emailed or filed by this download.',
  'ES: Las casillas reflejan la última revisión manual. Revise de nuevo tras cambiar las fuentes. Esta descarga no contabiliza, paga, envía correos ni presenta declaraciones.',
  'Machine column identifiers are stable English. Original names and descriptions are preserved. / Los identificadores de columnas son estables en inglés; se conservan los nombres y descripciones originales.'
 ].join('\n')+'\n')});
 files.push({name:'manifest.json',bytes:exportBytes(JSON.stringify({kind:'annual-administration-collection',entity:y.issuer_id,year:y.fiscal_year,snapshot_at:s.snapshot_at,statutory_complete:false,purchase_costs:s.costs.length,review_exceptions:exceptions.length,files:files.map(f=>({name:f.name,bytes:f.bytes.length,sha256:exportHash(f.bytes)}))},null,2)+'\n')});
 return files;
}
