import {NextRequest} from "next/server";
import {requireEstateAdmin} from "../../../../../../lib/security/estate-properties";
import {buildAccountantZip,exportBytes,exportHash} from "../../../../../../lib/property-operations/accountant-archive";
import {GET as purchaseRehearsal} from "../accountant-export/route";
import {GET as salesRehearsal} from "../sales-export/route";
export const dynamic="force-dynamic";
export const runtime="nodejs";
const headers={"Cache-Control":"private, no-store","X-Robots-Tag":"noindex, nofollow"};
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * A single convenience download containing two independently checked PARTIAL
 * reports, not consolidated accounting or proof of bank reconciliation.
 */
export async function GET(request:NextRequest){
 if(process.env.VERCEL_ENV!=="preview"||
   process.env.NEXT_PUBLIC_SUPABASE_URL!=="https://senonkpxdtlhyhrubicg.supabase.co")
   return new Response(null,{status:404,headers});
 await requireEstateAdmin();
 const query=new URL(request.url).searchParams;
 const entity=query.get("entity")??"",year=query.get("year")??"";
 if(!uuid.test(entity)||!/^20\d{2}$/.test(year)||Number(year)>2100)
   return new Response("Selecteer een geldige juridische entiteit en kalenderjaar.",{status:400,headers});
 try{
  // These modules independently check active admin, exact entity, complete
  // source pagination and source-document integrity. Never use network fetch.
  const [purchases,sales]=await Promise.all([
   purchaseRehearsal(request),salesRehearsal(request)
  ]);
  if(purchases.status!==200||sales.status!==200 ||
     purchases.headers.get("content-type")!=="application/zip" ||
     sales.headers.get("content-type")!=="application/zip")
    throw Error("One subsidiary financial report is unavailable");
  const [a,b]=await Promise.all([purchases.arrayBuffer(),sales.arrayBuffer()]);
  // This first synchronous preview is intentionally bounded for Vercel.
  if(a.byteLength<22||b.byteLength<22||
    a.byteLength+b.byteLength>3*1024*1024)throw Error("Rehearsal limit exceeded");
  const first=new Uint8Array(a),second=new Uint8Array(b);
  const readme=exportBytes([
   "MZS GROUP — PARTIAL ACCOUNTANT REVIEW BUNDLE, STAGING ONLY",
   "Legal entity ID: "+entity,
   "Year: "+year,
   "Contents: two independently reviewed archives, NOT one statutory ledger.",
   "purchase-review.zip: approved original supplier expenses, source documents and exceptions.",
   "sales-receipts-review.zip: issued rental/booking invoices and recorded receipt events.",
   "NOT INCLUDED: all unbilled booking settlements, bank reconciliation, credit notes, payroll, VAT returns, capital or statutory accounts.",
   "Review the README and manifest inside BOTH nested ZIPs before relying on figures.",
   "A missing or oversized subsidiary report prevents this entire bundle from being downloaded.",
   "No invoice, payment, e-mail or Production record was modified."
  ].join("\n")+"\n");
  const files=[
   {name:"purchase-review.zip",bytes:first},
   {name:"sales-receipts-review.zip",bytes:second},
   {name:"README.txt",bytes:readme}
  ];
  const manifest=exportBytes(JSON.stringify({
    kind:"mzs-staging-partial-accountant-bundle",entity,year,
    statutory_complete:false,
    files:files.map(f=>({name:f.name,sha256:exportHash(f.bytes),bytes:f.bytes.length}))
   },null,2)+"\n");
  const zip=buildAccountantZip([...files,{name:"manifest.json",bytes:manifest}]);
  return new Response(new Uint8Array(zip),{headers:{...headers,
    "Content-Type":"application/zip",
    "Content-Disposition":'attachment; filename="MZS-Accountant-REVIEW-'+year+'-'+entity.slice(0,8)+'.zip"'
  }});
 }catch{
  return new Response("Geen volledig controlepakket beschikbaar. Beide deelrapporten moeten slagen; er wordt geen gedeeltelijke ZIP verstrekt.",{status:503,headers});
 }
}
