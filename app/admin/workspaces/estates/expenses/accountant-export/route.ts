import {NextRequest} from "next/server";
import {requireEstateAdmin} from "../../../../../../lib/security/estate-properties";
import {accountantCsv} from "../../../../../../lib/property-operations/finance";
import {buildAccountantZip,exportHash,exportBytes,type ArchiveFile} from "../../../../../../lib/property-operations/accountant-archive";

export const dynamic="force-dynamic";
export const runtime="nodejs";
const staging="https://senonkpxdtlhyhrubicg.supabase.co";
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const headers={"Cache-Control":"private, no-store","X-Robots-Tag":"noindex, nofollow"};
const fail=()=>new Response("Volledige financiële proefexport niet beschikbaar. Geen gedeeltelijk bestand gegenereerd.",{status:503,headers});

type Draft={
 id:string;legal_entity_id:string;property_id:string;supplier_relationship_id:string;
 supplier_invoice_number:string;invoice_date:string;category:string;description:string;
 net_cents:number|string;vat_cents:number|string;gross_cents:number|string;
 currency:string;allocations:unknown;status:string
};
type Review={draft_id:string;sequence_no:number;action:string};
type Evidence={draft_id:string;storage_path:string;sha256:string;mime_type:string;file_size:number};
type Correction={id:string;draft_id:string;reason:string};
type Decision={id:string;correction_id:string;decision:string};
type Supplier={id:string;name:string};

function money(v:unknown):number{
 if((typeof v!=="number"&&typeof v!=="string")||!/^\d{1,12}$/.test(String(v)))
  throw Error("Invalid integer cents");
 const n=Number(v);if(!Number.isSafeInteger(n)||n<0||n>100000000000)throw Error("Money overflow");
 return n;
}
function amount(cents:number){return (cents/100).toFixed(2);}
function attachments(draftId:string,allocated:unknown,net:number,vat:number){
 if(!Array.isArray(allocated)||allocated.length<1||allocated.length>100)throw Error("Invalid allocations");
 let netSum=0,vatSum=0;
 const rows=allocated.map(x=>{
  if(!x||typeof x!=="object"||Array.isArray(x))throw Error("Invalid allocation row");
  const v=x as {unit_id:unknown;net_cents:unknown;vat_cents:unknown};
  if(v.unit_id!==null&&(typeof v.unit_id!=="string"||!uuid.test(v.unit_id)))throw Error("Unexpected unit");
  const a=money(v.net_cents),b=money(v.vat_cents);netSum+=a;vatSum+=b;
  return {draft_id:draftId,unit_id:v.unit_id??"",net_eur:amount(a),
    vat_eur:amount(b),total_eur:amount(a+b)};
 });
 if(netSum!==net||vatSum!==vat)throw Error("Unbalanced allocation");
 return rows;
}

/** Complete, counted, bounded, ordered entity-scoped reads. Nothing is emitted until all pass. */
async function collect(query:()=>any,max=5000){
 const rows:any[]=[];let total:number|null=null;const seen=new Set<string>();
 for(let offset=0;offset<max;offset+=200){
  const res=await query().range(offset,offset+199);
  if(res.error||!Array.isArray(res.data)||res.count===null)throw Error("Incomplete financial register");
  if(total===null)total=res.count;
  if(res.count!==total||res.data.length>200)throw Error("Register changed during export");
  for(const row of res.data){
   if(!row.id||seen.has(row.id))throw Error("Duplicate or changed register");
   seen.add(row.id);rows.push(row);
  }
  if(rows.length===total)return rows;
  if(!res.data.length||res.data.length<200)throw Error("Incomplete pagination");
 }
 throw Error("Export size cap exceeded");
}
async function linkedRows(db:any,table:string,draftIds:string[],fields:string){
 const all:any[]=[];
 for(let start=0;start<draftIds.length;start+=80){
  const ids=draftIds.slice(start,start+80);
  // 2 review events or 1 document per cost; 500 cap fails closed if exceeded.
  const q=await db.from(table).select(fields,{count:"exact"}).in("draft_id",ids).limit(500);
  if(q.error||!q.data||q.count===null||q.data.length!==q.count)throw Error("Incomplete linked records");
  all.push(...q.data);
 }
 return all;
}

async function decisionRows(db:any,correctionIds:string[]):Promise<Decision[]>{
 const all:Decision[]=[];
 for(let start=0;start<correctionIds.length;start+=80){
  const ids=correctionIds.slice(start,start+80);
  const q=await db.from("mzs_ops_expense_correction_decisions")
   .select("id,correction_id,decision",{count:"exact"}).in("correction_id",ids).limit(500);
  if(q.error||!q.data||q.count===null||q.data.length!==q.count)
   throw Error("Incomplete correction decision register");
  all.push(...q.data);
 }
 return all;
}

/** Incomplete pilot export: approved property purchase expenses only, not complete legal books. */
export async function GET(request:NextRequest){
 if(process.env.VERCEL_ENV!=="preview"||process.env.NEXT_PUBLIC_SUPABASE_URL!==staging)
  return new Response(null,{status:404,headers});
 const {db}=await requireEstateAdmin();
 const params=new URL(request.url).searchParams;
 const legalEntityId=params.get("entity")??"";
 const rawYear=params.get("year")??"";
 if(!uuid.test(legalEntityId)||!/^20\d{2}$/.test(rawYear)||Number(rawYear)>2100)
  return new Response("Selecteer een geldige entiteit en boekjaar.",{status:400,headers});
 const year=Number(rawYear);
 try{
  const {data:entity,error:entityError}=await db.from("mzs_lease_issuers")
   .select("id,name,kind").eq("id",legalEntityId).maybeSingle();
  if(entityError||!entity)throw Error("Missing entity");
  const drafts:Draft[]=await collect(()=>db.from("mzs_ops_expense_drafts")
   .select("id,legal_entity_id,property_id,supplier_relationship_id,supplier_invoice_number,invoice_date,category,description,net_cents,vat_cents,gross_cents,currency,allocations,status",{count:"exact"})
   .eq("legal_entity_id",legalEntityId)
   .gte("invoice_date",year+"-01-01")
   .lt("invoice_date",(year+1)+"-01-01")
   .order("id"),5000);
  const ids=drafts.map(x=>x.id);
  const [reviews,docs,corrections]=await Promise.all([
   linkedRows(db,"mzs_ops_expense_review_events",ids,"id,draft_id,sequence_no,action"),
   linkedRows(db,"mzs_ops_expense_documents",ids,"id,draft_id,storage_path,sha256,mime_type,file_size"),
   linkedRows(db,"mzs_ops_expense_correction_requests",ids,"id,draft_id,reason")
  ]) as [Review[],Evidence[],Correction[]];
  const decisions=await decisionRows(db,corrections.map(x=>x.id));
  const decisionMap=new Map<string,string>();
  for(const d of decisions){
   if(decisionMap.has(d.correction_id)||!corrections.some(c=>c.id===d.correction_id)||
    !["declined","replacement_required"].includes(d.decision))throw Error("Invalid correction decision");
   decisionMap.set(d.correction_id,d.decision);
  }
  const correctionMap=new Map<string,Correction>();
  const reviewMap=new Map<string,Review>(),docMap=new Map<string,Evidence>(),correctionIds=new Set<string>();
  for(const r of reviews){
   if(!ids.includes(r.draft_id))throw Error("Cross-entity review");
   const previous=reviewMap.get(r.draft_id);
   if(!previous||r.sequence_no>previous.sequence_no)reviewMap.set(r.draft_id,r);
  }
  for(const d of docs){
   if(!ids.includes(d.draft_id)||docMap.has(d.draft_id))throw Error("Duplicate or cross-entity document");
   docMap.set(d.draft_id,d);
  }
  for(const c of corrections){
   if(!ids.includes(c.draft_id)||correctionIds.has(c.draft_id))throw Error("Duplicate or cross-entity correction");
   correctionIds.add(c.draft_id);
   correctionMap.set(c.draft_id,c);
  }

  const supplierIds=[...new Set(drafts.map(x=>x.supplier_relationship_id))];
  const supplierMap=new Map<string,string>();
  for(let k=0;k<supplierIds.length;k+=80){
   const part=supplierIds.slice(k,k+80);
   const res=await db.from("mzs_lease_relationships").select("id,name",{count:"exact"}).in("id",part).limit(100);
   if(res.error||res.count!==part.length||!res.data||res.data.length!==part.length)throw Error("Supplier directory incomplete");
   for(const s of res.data as Supplier[])supplierMap.set(s.id,s.name);
  }

  const purchaseRows:Record<string,unknown>[]=[],allocationRows:Record<string,unknown>[]=[],exceptionRows:Record<string,unknown>[]=[];
  const files:ArchiveFile[]=[];
  const fileManifest:{name:string;sha256:string;bytes:number}[]=[];
  const add=(name:string,bytes:Uint8Array)=>{files.push({name,bytes});fileManifest.push({name,sha256:exportHash(bytes),bytes:bytes.length});};
  for(const d of drafts){
   if(d.legal_entity_id!==legalEntityId||!d.invoice_date.startsWith(rawYear+"-")||d.currency!=="EUR")
    throw Error("Mixed entity, period or currency");
   const net=money(d.net_cents),vat=money(d.vat_cents),gross=money(d.gross_cents);
   if(net+vat!==gross||gross<=0)throw Error("Invoice totals inconsistent");
   const allocation=attachments(d.id,d.allocations,net,vat);
   const state=reviewMap.get(d.id)?.action??"draft";
   const doc=docMap.get(d.id);
   const correction=correctionMap.get(d.id);
   const decision=correction?decisionMap.get(correction.id):null;
   const correctionPending=!!correction && decision!=="declined";
   if(!["draft","submitted","approved","rejected"].includes(state))throw Error("Unknown review status");
   const ready=state==="approved"&&!correctionPending;
   if(!ready){
    exceptionRows.push({
     draft_id:d.id,invoice_number:d.supplier_invoice_number,invoice_date:d.invoice_date,
     review_status:state,has_original:!!doc,correction_pending:correctionPending,
     reason:correctionPending?(decision==="replacement_required"?"Replacement evidence and new financial review required":"Correction proposal awaiting decision"):
      !doc?"Original invoice not uploaded":"Not an approved supplier expense",
     net_eur:amount(net),vat_eur:amount(vat),gross_eur:amount(gross)
    });
    continue;
   }
   if(!doc||!doc.storage_path||!/^[0-9a-f]{64}$/.test(doc.sha256)||!doc.file_size)
    throw Error("Approved cost missing verified source evidence");
   const {data:source,error:sourceError}=await db.storage.from("mzs-ops-expense-evidence")
    .download(doc.storage_path);
   if(sourceError||!source)throw Error("Approved source file unavailable");
   const bytes=new Uint8Array(await source.arrayBuffer());
   if(bytes.length!==doc.file_size||bytes.length>4194304||exportHash(bytes)!==doc.sha256)
    throw Error("Source document integrity mismatch");
   const ext=doc.mime_type==="application/pdf"?"pdf":doc.mime_type==="image/png"?"png":
    doc.mime_type==="image/jpeg"?"jpg":null;
   if(!ext)throw Error("Unknown original media type");
   const name="documents/"+d.id+"."+ext;
   add(name,bytes);
   purchaseRows.push({
    draft_id:d.id,entity_id:legalEntityId,entity_name:entity.name,
    supplier_id:d.supplier_relationship_id,supplier_name:supplierMap.get(d.supplier_relationship_id)??"",
    supplier_invoice_number:d.supplier_invoice_number,invoice_date:d.invoice_date,
    property_id:d.property_id,category:d.category,description:d.description,
    currency:"EUR",net_eur:amount(net),vat_eur:amount(vat),gross_eur:amount(gross),
    source_file:name,source_sha256:doc.sha256,review_status:"approved",
    payment_status:"not recorded in Property Operations"
   });
   for(const a of allocation)allocationRows.push({
    entity_id:legalEntityId,property_id:d.property_id,
    ...a
   });
  }
  const csv=(columns:string[],data:Record<string,unknown>[])=>accountantCsv(columns,data);
  add("purchase-invoices.csv",exportBytes(csv([
   "draft_id","entity_id","entity_name","supplier_id","supplier_name",
   "supplier_invoice_number","invoice_date","property_id","category","description",
   "currency","net_eur","vat_eur","gross_eur","source_file","source_sha256",
   "review_status","payment_status"
  ],purchaseRows)));
  add("property-allocations.csv",exportBytes(csv([
   "entity_id","property_id","draft_id","unit_id","net_eur","vat_eur","total_eur"
  ],allocationRows)));
  add("exceptions.csv",exportBytes(csv([
   "draft_id","invoice_number","invoice_date","review_status","has_original",
   "correction_pending","reason","net_eur","vat_eur","gross_eur"
  ],exceptionRows)));
  const readme=[
   "MZS GROUP — PROPERTY OPERATIONS ACCOUNTANT EXPORT — STAGING REHEARSAL",
   "NOT A COMPLETE LEGAL ACCOUNTING EXPORT. DO NOT FILE A TAX RETURN FROM THIS DATA.",
   "Entity: "+entity.name+" ("+legalEntityId+")",
   "Invoice-date year: "+year,
   "Approved purchase costs: "+purchaseRows.length,
   "Unresolved/pending/uncorrected cost drafts: "+exceptionRows.length,
   "Included: approved supplier costs, original evidence, property allocations.",
   "Not included: sales invoices, payments, bank reconciliations, payroll, capital or tax returns.",
   "Pending or replacement-required corrections exclude the original cost from approved purchases.",
   "Declined corrections preserve the previously approved original; every decision remains in the audit register.",
   "All amounts EUR; VAT values originate from supplier cost records, not a tax determination.",
   "Source document SHA-256 and per-file hashes appear in manifest.json.",
   "No real personal records are seeded automatically by this preview.",
  ].join("\n")+"\n";
  add("README.txt",exportBytes(readme));
  add("manifest.json",exportBytes(JSON.stringify({
   kind:"mzs-property-operations-staging-partial-export",year,
   legal_entity_id:legalEntityId,legal_entity_name:entity.name,
   purchase_rows:purchaseRows.length,exceptions:exceptionRows.length,
   completeness:"partial—not statutory accountancy",
   files:fileManifest
  },null,2)+"\n"));
  const zipped=buildAccountantZip(files);
  return new Response(new Uint8Array(zipped),{
   status:200,headers:{...headers,
    "Content-Type":"application/zip",
    "Content-Disposition":'attachment; filename="MZS-Property-Operations-REVIEW-'+year+'-'+legalEntityId.slice(0,8)+'.zip"'
   }
  });
 }catch{
  return fail();
 }
}
