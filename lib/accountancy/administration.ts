export const ADMINISTRATION_ROOT='/admin/workspaces/accountancy/administrations';
export const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const costCategories={advice:'Professional advice',utilities:'Utilities',maintenance:'Maintenance and repairs',renovation:'Renovation projects',improvements:'Improvements and extensions',insurance:'Insurance',bank_charges:'Bank charges',depreciation:'Depreciation',taxes:'Taxes',management:'Management',other:'Other costs'} as const;
export type CostCategory=keyof typeof costCategories;
export const checkLabels={income:'Income and issued invoices',costs:'Supplier costs and project allocation',bank:'Bank statements and payment reconciliation',assets:'Property, improvements and depreciation',financing:'Loans and related-party balances',tax:'Tax treatment and annual adjustments',documents:'Supporting documents and outstanding questions'} as const;
export type Year={id:string;issuer_id:string;fiscal_year:number;purpose:'current'|'reference';vat_treatment:'pending'|'no_recovery'|'source_records';vat_effective_from:string|null;vat_evidence:string;notes:string;checks:Record<keyof typeof checkLabels,boolean>;revision:number;updated_at:string};
export type Project={id:string;year_id:string;name:string;kind:'renovation'|'improvements';property_id:string|null;source_reference:string};
export type Cost={id:string;legal_entity_id:string;invoice_date:string;supplier_relationship_id:string;supplier_name:string;supplier_invoice_number:string;property_id:string|null;property_name:string|null;cost_scope:'entity'|'property';category:string;description:string;net_cents:number;vat_cents:number;gross_cents:number;created_at:string;allocations:unknown;source_document_status:string;source_pdf_id?:string;source_pdf_sha256?:string;archive_documents?:{id:string;title:string;sha256:string;review_status:string}[]};
export type Review={draft_id:string;year_id:string;category:CostCategory;project_id:string|null;review_status:'pending'|'reviewed'|'excluded';evidence_reference:string;note:string;revision:number;updated_at:string};
export type YearSource={administration:Year;sales:Record<string,any>;costs:Cost[];reviews:Review[];projects:Project[];documents:Record<string,any>[];capital_references:Record<string,any>[];snapshot_at:string};
export function annualCategory(value:string):CostCategory{
 if(value in costCategories)return value as CostCategory;
 if(['electricity','gas','water','internet'].includes(value))return 'utilities';
 if(['cleaning','materials'].includes(value))return 'maintenance';
 return 'other';
}
export function validateYearSource(value:YearSource,id:string):YearSource{
 const y=value?.administration;
 if(!y||y.id!==id||!uuid.test(y.issuer_id)||!Number.isInteger(y.fiscal_year)||y.fiscal_year<2000||y.fiscal_year>2099||value.sales?.issuer?.id!==y.issuer_id)throw Error('Incomplete annual source');
 for(const key of ['costs','reviews','projects','documents','capital_references'] as const)if(!Array.isArray(value[key]))throw Error('Incomplete annual source');
 const ids=new Set<string>();
 for(const c of value.costs){
  if(!uuid.test(c.id)||ids.has(c.id)||c.legal_entity_id!==y.issuer_id||!c.invoice_date.startsWith(y.fiscal_year+'-')||![c.net_cents,c.vat_cents,c.gross_cents].every(x=>Number.isSafeInteger(x)&&x>=0)||c.net_cents+c.vat_cents!==c.gross_cents||(c.cost_scope==='entity'?c.property_id!==null:!c.property_id))throw Error('Invalid annual cost');ids.add(c.id);
 }
 const reviewIds=new Set<string>(),projects=new Map(value.projects.map(p=>[p.id,p]));
 if(projects.size!==value.projects.length||value.projects.some(p=>p.year_id!==id))throw Error('Invalid annual project');
 for(const r of value.reviews){const c=value.costs.find(c=>c.id===r.draft_id),p=r.project_id?projects.get(r.project_id):null;
  if(!c||reviewIds.has(r.draft_id)||r.year_id!==id||!(r.category in costCategories)||!['pending','reviewed','excluded'].includes(r.review_status)||(r.project_id&&(!p||p.property_id!==c.property_id)))throw Error('Invalid annual review');reviewIds.add(r.draft_id);
 }
 if(value.documents.some(d=>d.issuer_id!==y.issuer_id||d.fiscal_year!==y.fiscal_year)||value.capital_references.some(c=>c.entity_id!==y.issuer_id))throw Error('Invalid annual reference');
 if(Object.keys(checkLabels).some(k=>typeof y.checks?.[k as keyof typeof checkLabels]!=='boolean'))throw Error('Invalid annual checklist');
 return value;
}
export function annualSummary(source:YearSource){
 const reviews=new Map(source.reviews.map(r=>[r.draft_id,r]));
 const totals={reviewed:0,pending:0,excluded:0,reviewedGross:0,pendingGross:0,excludedGross:0};
 const categories=Object.keys(costCategories).map(key=>({key:key as CostCategory,reviewedGross:0,pendingGross:0,excludedGross:0,count:0}));
 for(const c of source.costs){const r=reviews.get(c.id),status=r?.review_status??'pending',row=categories.find(x=>x.key===(r?.category??annualCategory(c.category)))!;totals[status]++;totals[`${status}Gross`]+=c.gross_cents;row[`${status}Gross`]+=c.gross_cents;row.count++;}
 if(Object.values(totals).some(x=>!Number.isSafeInteger(x)))throw Error('Annual totals exceed safe range');
 return {...totals,categories,checksCompleted:Object.values(source.administration.checks).filter(Boolean).length};
}
export function dateValue(raw:string){if(!/^\d{4}-\d{2}-\d{2}$/.test(raw)||Number.isNaN(Date.parse(raw+'T12:00:00Z'))||new Date(raw+'T12:00:00Z').toISOString().slice(0,10)!==raw)throw Error('invalid');return raw;}
export function textField(f:FormData,key:string,max:number,min=0){const raw=f.get(key);if(typeof raw!=='string')throw Error('invalid');const v=raw.trim();if(v.length<min||v.length>max||/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/.test(v))throw Error('invalid');return v;}
