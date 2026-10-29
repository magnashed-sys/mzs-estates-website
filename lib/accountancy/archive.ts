export const ARCHIVE_BUCKET = 'mzs-private-accountancy-documents';
export const ARCHIVE_ROOT = '/admin/workspaces/accountancy/documents';
export const MAX_PDF_BYTES = 20 * 1024 * 1024;
export const PAGE_SIZE = 25;
export const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const categories = ['balance_sheet','profit_loss','trial_balance','journal','corporate_tax','vat_return','vat_summary','analysis','other','supplier_invoice','purchase_deed'] as const;
export const statuses = ['pending_review','needs_attention','reviewed','superseded'] as const;
export type Language = 'en'|'es';
export type Category = typeof categories[number];
export type ReviewStatus = typeof statuses[number];
export type Entity = {id:string;name:string;tax_id:string|null};
export type ArchiveDocument = {
 id:string;issuer_id:string;fiscal_year:number;title:string;original_name:string;category:Category;
 period_label:string;document_date:string|null;review_status:ReviewStatus;notes:string;file_path:string;
 file_size_bytes:number;sha256:string;created_at:string;updated_at:string;revision:number;
};
export type ArchiveFields = Pick<ArchiveDocument,'title'|'category'|'period_label'|'document_date'|'review_status'|'notes'>;
export type Filters = {entity:string;year:string;category:string;status:string;q:string;page:number};
export function archiveFilters(raw:Record<string,string|string[]|undefined>):Filters {
 const one=(key:string,fallback='')=>{const v=raw[key];if(Array.isArray(v))throw Error('filters');return v||fallback;};
 const f={entity:one('entity','all'),year:one('year','all'),category:one('category','all'),status:one('status','all'),q:one('q').trim(),page:Number(one('page','1'))};
 if((f.entity!=='all'&&!uuid.test(f.entity))||(f.year!=='all'&&!/^(19|20|21)\d{2}$/.test(f.year))||
  (f.category!=='all'&&!categories.includes(f.category as Category))||(f.status!=='all'&&!statuses.includes(f.status as ReviewStatus))||
  f.q.length>160||!Number.isSafeInteger(f.page)||f.page<1||f.page>100000)throw Error('filters');
 return f;
}
export function archiveHref(f:Filters,page=f.page){
 const p=new URLSearchParams();for(const key of ['entity','year','category','status','q'] as const)if(f[key]&&f[key]!=='all')p.set(key,f[key]);
 if(page>1)p.set('page',String(page));return ARCHIVE_ROOT+(p.size?'?'+p:'');
}
export function archiveFields(form:FormData):ArchiveFields {
 const text=(key:string,max:number,min=0)=>{const value=form.get(key);if(typeof value!=='string')throw Error('invalid');const s=value.trim();if(s.length<min||s.length>max||s.includes('\u0000'))throw Error('invalid');return s;};
 const title=text('title',160,2),category=text('category',40),review_status=text('review_status',40),period_label=text('period_label',40),notes=text('notes',4000),date=text('document_date',10);
 if(!categories.includes(category as Category)||!statuses.includes(review_status as ReviewStatus))throw Error('invalid');
 if(date&&(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(Date.parse(date))||new Date(date).toISOString().slice(0,10)!==date))throw Error('invalid');
 return {title,category:category as Category,review_status:review_status as ReviewStatus,period_label,notes,document_date:date||null};
}
export function documentPath(entity:string,year:number,id:string){
 if(!uuid.test(entity)||!uuid.test(id)||!Number.isInteger(year)||year<1900||year>2199)throw Error('invalid');
 return `${entity.toLowerCase()}/${year}/${id.toLowerCase()}.pdf`;
}
export function validatePdf(bytes:Uint8Array){
 if(bytes.length<5||bytes.length>MAX_PDF_BYTES||new TextDecoder().decode(bytes.slice(0,5))!=='%PDF-')throw Error('invalid_pdf');
}
export const copy = {
 en:{title:'Document archive',intro:'Private records by legal entity and financial year.',back:'Accountancy',entity:'Entity',year:'Financial year',category:'Document type',status:'Review status',search:'Document title',all:'All',filter:'Apply filters',clear:'Clear filters',upload:'Add document',file:'PDF file (up to 20 MiB)',documentTitle:'Title',period:'Period / reference',date:'Document date',notes:'Notes for the accountant',submit:'Archive document',saving:'Saving…',saved:'Document saved.',savedAndLinked:'Original PDF saved in the private archive and linked to this dossier.',savedButUnlinked:'Original PDF saved in the private archive, but the dossier link could not be confirmed. Refresh and link the saved document below.',failed:'The document could not be saved. Please retry.',invalid:'Check the document details.',invalid_pdf:'Choose a valid PDF up to 20 MiB.',duplicate:'This PDF is already archived for this entity and year.',stale:'This record changed. Refresh the page before saving again.',empty:'No documents match these filters.',count:'documents',open:'Open PDF',details:'Details & review',download:'Download PDF',edit:'Save review',history:'Change history',created:'Archived',updated:'Updated',system:'Administrative import',original:'Original filename',retained:'Original files are retained. Upload a revised PDF as a separate document.',reference:'Reference documents do not create accounting entries or change tax settings.',language:'Archive language',languageSave:'Save language',previous:'Previous',next:'Next',page:'Page',retry:'Try again',unavailable:'The archive could not be loaded.',source:'Entity, year and original file are fixed to preserve the record. Use “Superseded” if a document was filed incorrectly.',auditNote:'History records the title, classification, notes and review status at each change.',revision:'Revision',reviewHelp:'Review status records an administrative check; it does not certify a tax filing.',invalidFilters:'Invalid archive filters.',sourceHash:'Original file fingerprint',fileSize:'File size'},
 es:{title:'Archivo documental',intro:'Documentación privada por entidad jurídica y ejercicio.',back:'Contabilidad',entity:'Entidad',year:'Ejercicio',category:'Tipo de documento',status:'Estado de revisión',search:'Título del documento',all:'Todos',filter:'Aplicar filtros',clear:'Quitar filtros',upload:'Añadir documento',file:'Archivo PDF (hasta 20 MiB)',documentTitle:'Título',period:'Período / referencia',date:'Fecha del documento',notes:'Notas para el asesor',submit:'Archivar documento',saving:'Guardando…',saved:'Documento guardado.',savedAndLinked:'PDF original guardado en el archivo privado y vinculado a este expediente.',savedButUnlinked:'PDF original guardado en el archivo privado, pero no se pudo confirmar el vínculo. Actualiza la página y vincula el documento guardado más abajo.',failed:'No se ha podido guardar el documento. Inténtalo de nuevo.',invalid:'Revisa los datos del documento.',invalid_pdf:'Selecciona un PDF válido de hasta 20 MiB.',duplicate:'Este PDF ya está archivado para esta entidad y ejercicio.',stale:'El registro ha cambiado. Actualiza la página antes de guardar.',empty:'No hay documentos que coincidan con estos filtros.',count:'documentos',open:'Abrir PDF',details:'Detalles y revisión',download:'Descargar PDF',edit:'Guardar revisión',history:'Historial de cambios',created:'Archivado',updated:'Actualizado',system:'Importación administrativa',original:'Nombre original',retained:'Se conservan los archivos originales. Sube cada PDF revisado como un documento independiente.',reference:'Los documentos de consulta no crean asientos contables ni cambian la configuración fiscal.',language:'Idioma del archivo',languageSave:'Guardar idioma',previous:'Anterior',next:'Siguiente',page:'Página',retry:'Reintentar',unavailable:'No se ha podido cargar el archivo documental.',source:'La entidad, el ejercicio y el archivo original quedan fijados para conservar el registro. Usa «Sustituido» si se archivó incorrectamente.',auditNote:'El historial conserva el título, la clasificación, las notas y el estado de revisión de cada cambio.',revision:'Revisión',reviewHelp:'El estado refleja una comprobación administrativa; no certifica una declaración fiscal.',invalidFilters:'Los filtros del archivo no son válidos.',sourceHash:'Huella del archivo original',fileSize:'Tamaño del archivo'}
} as const;
export const categoryLabels:Record<Language,Record<Category,string>> = {
 en:{supplier_invoice:'Supplier invoice',purchase_deed:'Property purchase deed',balance_sheet:'Balance sheet',profit_loss:'Profit & loss',trial_balance:'Trial balance',journal:'Journal',corporate_tax:'Corporate tax return',vat_return:'VAT return',vat_summary:'Annual VAT summary',analysis:'Analysis report',other:'Other supporting document'},
 es:{supplier_invoice:'Factura de proveedor',purchase_deed:'Escritura de compraventa',balance_sheet:'Balance de situación',profit_loss:'Pérdidas y ganancias',trial_balance:'Sumas y saldos',journal:'Libro diario',corporate_tax:'Impuesto sobre Sociedades',vat_return:'Autoliquidación de IVA',vat_summary:'Resumen anual de IVA',analysis:'Informe de análisis',other:'Otra documentación'}
};
export const statusLabels:Record<Language,Record<ReviewStatus,string>> = {
 en:{pending_review:'Pending review',needs_attention:'Needs attention',reviewed:'Reviewed',superseded:'Superseded'},
 es:{pending_review:'Pendiente de revisión',needs_attention:'Requiere atención',reviewed:'Revisado',superseded:'Sustituido'}
};
