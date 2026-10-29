
import {getAdminI18n} from '../../../lib/admin/i18n-server';
import Link from "next/link";
import {resolvePilotEnvironment} from "../../../lib/property-operations/pilot-environment";
import AdminPanels from "../AdminPanels";
import {requireEstateAdmin} from "../../../lib/security/estate-properties";
export const dynamic="force-dynamic";
export default async function ManagementPage(){
 const {t:adminT,locale:adminLocale}=await getAdminI18n();

 await requireEstateAdmin();
 
 const isolatedPilotAvailable=resolvePilotEnvironment({VERCEL_ENV:process.env.VERCEL_ENV,NEXT_PUBLIC_SUPABASE_URL:process.env.NEXT_PUBLIC_SUPABASE_URL,VERCEL_GIT_COMMIT_SHA:process.env.VERCEL_GIT_COMMIT_SHA,MZS_OPS_PRODUCTION_PILOT_ENABLED:process.env.MZS_OPS_PRODUCTION_PILOT_ENABLED,MZS_OPS_PRODUCTION_PILOT_RELEASE_SHA:process.env.MZS_OPS_PRODUCTION_PILOT_RELEASE_SHA})==="production";
 return <><AdminPanels key="analytics" section="analytics" />{isolatedPilotAvailable&&<section style={{padding:24,background:"#151411",color:"#eee8dd"}}><h2>{adminT("Isolated test environment")}</h2><p>{adminT("No invoices, payroll or supplier orders.")}</p><Link href="/admin/property-operations-pilot">{adminT("Open Property Operations pilot →")}</Link></section>}</>;
}
