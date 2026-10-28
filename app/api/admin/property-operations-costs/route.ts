import {NextRequest} from "next/server";
import {requireEstateAdmin} from "../../../../lib/security/estate-properties";
import {buildOpsCostSummary,type OpsDraft,type OpsEvidence,type OpsReview,
 type OpsCorrection,type OpsDecision,type OpsReplacement} from "../../../../lib/property-operations/financial-summary";
export const dynamic="force-dynamic";
const headers={"Cache-Control":"private, no-store","X-Robots-Tag":"noindex, nofollow"};
const staging="https://senonkpxdtlhyhrubicg.supabase.co";
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Every page must be complete and based on the same reported total. */
async function fullRegister(query:()=>any,limit=5000):Promise<any[]>{
 const rows:any[]=[],seen=new Set<string>();
 let total:number|null=null;
 for(let offset=0;offset<limit;offset+=200){
  const response=await query().range(offset,offset+199);
  if(response.error||!Array.isArray(response.data)||!Number.isSafeInteger(response.count)||
    response.count>limit)throw Error("Incomplete source register");
  if(total===null)total=response.count;
  if(response.count!==total)throw Error("Reporting source changed during paging");
  for(const row of response.data){
   if(!row.id||seen.has(row.id))throw Error("Duplicate or changed financial record");
   seen.add(row.id);rows.push(row);
  }
  if(rows.length===total)return rows;
  if(response.data.length<200)throw Error("Incomplete source pagination");
 }
 throw Error("Reporting source exceeds safe limit");
}

/**
 * Additive staging-only cost section. Never changes existing forecasts/net cash
 * because purchase approval does not establish an actual supplier bank payment.
 */
export async function GET(request:NextRequest){
 if(process.env.VERCEL_ENV!=="preview"||process.env.NEXT_PUBLIC_SUPABASE_URL!==staging)
  return Response.json({error:"Not available"},{status:404,headers});
 try{
  const {db}=await requireEstateAdmin();
  const q=request.nextUrl.searchParams;
  const year=Number(q.get("year")??"");
  const entityId=q.get("entity")??"";
  if(!Number.isInteger(year)||year<2020||year>2100||
    !(entityId==="all"||entityId==="unassigned"||uuid.test(entityId)))
   return Response.json({error:"Invalid reporting period or entity"},{status:400,headers});
  const issuers=await fullRegister(()=>db.from("mzs_lease_issuers").select("id,name",{count:"exact"}).order("id"));
  const properties=await fullRegister(()=>db.from("mzs_estate_properties")
   .select("id,name",{count:"exact"}).order("id"));
  const propertyById=new Map(properties.map(x=>[x.id,x.name]));
  const ids=new Set(issuers.map(x=>x.id));
  if(entityId!=="all"&&entityId!=="unassigned"&&!ids.has(entityId))
   return Response.json({error:"Unknown reporting entity"},{status:400,headers});
  const [drafts,documents,reviews,corrections,decisions,replacements]=await Promise.all([
   fullRegister(()=>db.from("mzs_ops_expense_drafts")
    .select("id,property_id,legal_entity_id,invoice_date,net_cents,vat_cents,gross_cents,category",{count:"exact"}).order("id")),
   fullRegister(()=>db.from("mzs_ops_expense_documents")
    .select("id,draft_id,sha256",{count:"exact"}).order("id")),
   fullRegister(()=>db.from("mzs_ops_expense_review_events")
    .select("id,draft_id,sequence_no,action",{count:"exact"}).order("id")),
   fullRegister(()=>db.from("mzs_ops_expense_correction_requests")
    .select("id,draft_id",{count:"exact"}).order("id")),
   fullRegister(()=>db.from("mzs_ops_expense_correction_decisions")
    .select("id,correction_id,decision",{count:"exact"}).order("id")),
   fullRegister(()=>db.from("mzs_ops_expense_replacements")
    .select("id,correction_id,replacement_draft_id",{count:"exact"}).order("id"))
  ]);
  for(const d of drafts){
   if(!ids.has(d.legal_entity_id))throw Error("Unknown legal cost entity");
   if(!propertyById.has(d.property_id))throw Error("Missing physical cost property");
  }
  const result=buildOpsCostSummary({
   year,entityId,drafts:drafts as OpsDraft[],documents:documents as OpsEvidence[],
   reviews:reviews as OpsReview[],corrections:corrections as OpsCorrection[],
   decisions:decisions as OpsDecision[],replacements:replacements as OpsReplacement[]
  });
  return Response.json({...result,properties:result.properties.map(item=>({
   ...item,propertyName:propertyById.get(item.propertyId)
  }))},{headers});
 }catch{
  return Response.json({error:"Operating cost registers could not be fully verified. No partial totals are shown."},{status:503,headers});
 }
}
