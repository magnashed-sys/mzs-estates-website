import Link from "next/link";
import {resolvePilotEnvironment} from "../../../lib/property-operations/pilot-environment";
import AdminPanels from "../AdminPanels";
import {requireEstateAdmin} from "../../../lib/security/estate-properties";
export const dynamic="force-dynamic";
export default async function ManagementPage(){
 await requireEstateAdmin();
 
 const isolatedPilotAvailable=resolvePilotEnvironment({VERCEL_ENV:process.env.VERCEL_ENV,NEXT_PUBLIC_SUPABASE_URL:process.env.NEXT_PUBLIC_SUPABASE_URL,VERCEL_GIT_COMMIT_SHA:process.env.VERCEL_GIT_COMMIT_SHA,MZS_OPS_PRODUCTION_PILOT_ENABLED:process.env.MZS_OPS_PRODUCTION_PILOT_ENABLED,MZS_OPS_PRODUCTION_PILOT_RELEASE_SHA:process.env.MZS_OPS_PRODUCTION_PILOT_RELEASE_SHA})==="production";
 return <><AdminPanels key="analytics" section="analytics" />{isolatedPilotAvailable&&<section style={{padding:24,background:"#151411",color:"#eee8dd"}}><h2>Afgeschermde testomgeving</h2><p>Geen facturen, salarissen of leveranciersopdrachten.</p><Link href="/admin/property-operations-pilot">Open Property Operations pilot →</Link></section>}</>;
}
