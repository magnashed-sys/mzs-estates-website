import AdminPanels from "../AdminPanels";
import {requireEstateAdmin} from "../../../lib/security/estate-properties";
export const dynamic="force-dynamic";
export default async function ManagementPage( {searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){
 await requireEstateAdmin();
 const params=await searchParams;
 const value=typeof params.filter==="string"?params.filter:"pending";
 const filter=value==="approved"||value==="invitations"||value==="declined"||value==="all"?value:"pending";
 return <AdminPanels key="relationships" section="relationships" initialFilter={filter}/>;
}
