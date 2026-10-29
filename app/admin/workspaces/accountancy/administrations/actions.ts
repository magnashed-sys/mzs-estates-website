'use server';
import {revalidatePath} from 'next/cache';
import {requireEstateAdmin} from '../../../../../lib/security/estate-properties';
import {ADMINISTRATION_ROOT,uuid,dateValue,textField,costCategories,checkLabels} from '../../../../../lib/accountancy/administration';
import {inputEuroCents} from '../../../../../lib/property-operations/expense-preview';
export type Result={ok:boolean;code?:string;id?:string};
const invalid:Result={ok:false,code:'invalid'};
const failure=(code?:string):Result=>({ok:false,code:code==='23505'?'duplicate':'failed'});
function identifier(f:FormData,key:string){const v=textField(f,key,36);if(!uuid.test(v))throw Error('invalid');return v;}
function refresh(id?:string){revalidatePath(ADMINISTRATION_ROOT);if(id)revalidatePath(ADMINISTRATION_ROOT+'/'+id);revalidatePath('/admin/workspaces/estates/expenses');revalidatePath('/admin/workspaces/estates/reports');}
export async function createYear(f:FormData):Promise<Result>{
 const {db}=await requireEstateAdmin();let issuer,year,purpose;
 try{issuer=identifier(f,'issuer_id');const raw=textField(f,'fiscal_year',4,4);year=Number(raw);purpose=textField(f,'purpose',20);if(!/^20\d{2}$/.test(raw)||!['current','reference'].includes(purpose))throw Error();}catch{return invalid;}
 const {data,error}=await db.from('mzs_accountancy_years').insert({issuer_id:issuer,fiscal_year:year,purpose}).select('id').single();
 if(error){if(error.code==='23505'){const prior=await db.from('mzs_accountancy_years').select('id').eq('issuer_id',issuer).eq('fiscal_year',year).single();if(!prior.error)return {ok:true,id:prior.data.id};}return failure(error.code);}
 refresh(data.id);return {ok:true,id:data.id};
}
export async function saveYear(f:FormData):Promise<Result>{
 const {db}=await requireEstateAdmin();let id,revision,fields;
 try{id=identifier(f,'id');revision=Number(textField(f,'revision',10,1));const vat=textField(f,'vat_treatment',20);if(!Number.isSafeInteger(revision)||revision<1||!['pending','no_recovery','source_records'].includes(vat))throw Error();
 const effective=textField(f,'vat_effective_from',10),evidence=textField(f,'vat_evidence',2000);
 if(vat==='no_recovery'&&(!effective||evidence.length<5))throw Error();
 fields={vat_treatment:vat,vat_effective_from:effective?dateValue(effective):null,vat_evidence:evidence,notes:textField(f,'notes',4000),checks:Object.fromEntries(Object.keys(checkLabels).map(k=>[k,f.get('check_'+k)==='on']))};}catch{return invalid;}
 const {data,error}=await db.from('mzs_accountancy_years').update(fields).eq('id',id).eq('revision',revision).select('id').maybeSingle();
 if(error)return failure(error.code);if(!data)return {ok:false,code:'stale'};refresh(id);return {ok:true};
}
export async function createProject(f:FormData):Promise<Result>{
 const {db}=await requireEstateAdmin();let fields;
 try{const property=textField(f,'property_id',36),kind=textField(f,'kind',20);if(property&&!uuid.test(property)||!['renovation','improvements'].includes(kind))throw Error();fields={year_id:identifier(f,'year_id'),property_id:property||null,name:textField(f,'name',160,2),kind,source_reference:textField(f,'source_reference',1000)};}catch{return invalid;}
 const {error}=await db.from('mzs_accountancy_projects').insert(fields);if(error)return failure(error.code);refresh(fields.year_id);return {ok:true};
}
export async function saveCostReview(f:FormData):Promise<Result>{
 const {db}=await requireEstateAdmin();let fields,id,year,revision;
 try{id=identifier(f,'draft_id');year=identifier(f,'year_id');revision=Number(textField(f,'revision',10,1));const project=textField(f,'project_id',36),category=textField(f,'category',30),status=textField(f,'review_status',20),evidence=textField(f,'evidence_reference',1000),note=textField(f,'note',2000);
 if(!Number.isSafeInteger(revision)||revision<0||!(category in costCategories)||!['pending','reviewed','excluded'].includes(status)||(project&&!uuid.test(project))||(status==='reviewed'&&evidence.length<3)||(status==='excluded'&&note.length<5))throw Error();fields={category,project_id:project||null,review_status:status,evidence_reference:evidence,note};}catch{return invalid;}
 const q=revision===0?db.from('mzs_accountancy_cost_reviews').insert({...fields,draft_id:id,year_id:year}):db.from('mzs_accountancy_cost_reviews').update(fields).eq('draft_id',id).eq('year_id',year).eq('revision',revision);
 const {data,error}=await q.select('draft_id').maybeSingle();if(error)return error.code==='23505'?{ok:false,code:'stale'}:failure(error.code);if(!data)return {ok:false,code:'stale'};refresh(year);return {ok:true};
}
export async function createCost(f:FormData):Promise<Result>{
 const {db}=await requireEstateAdmin();let fields,year;
 try{year=identifier(f,'year_id');const {data:y,error}=await db.from('mzs_accountancy_years').select('issuer_id,fiscal_year').eq('id',year).single();if(error||!y)throw Error();
 const property=textField(f,'property_id',36),category=textField(f,'category',30),date=dateValue(textField(f,'invoice_date',10,10)),net=inputEuroCents(textField(f,'net',20,1)),vat=inputEuroCents(textField(f,'vat',20,1));
 if(property&&!uuid.test(property)||!(category in costCategories)||!date.startsWith(y.fiscal_year+'-')||net+vat===0)throw Error();
 fields={property_id:property||null,cost_scope:property?'property':'entity',legal_entity_id:y.issuer_id,supplier_relationship_id:identifier(f,'supplier_relationship_id'),supplier_invoice_number:textField(f,'supplier_invoice_number',100,1),invoice_date:date,category,description:textField(f,'description',500,2),net_cents:net,vat_cents:vat,allocations:[{unit_id:null,net_cents:net,vat_cents:vat}]};}catch{return invalid;}
 const {error}=await db.from('mzs_ops_expense_drafts').insert(fields);if(error)return {ok:false,code:error.code==='23505'?'duplicate':error.message.includes('paying entity')?'payer':'failed'};refresh(year);return {ok:true};
}
