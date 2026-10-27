import {redirect} from "next/navigation";
import {requireEstateAdmin} from "../../lib/security/estate-properties";
import {adminEntryRoute} from "../../lib/admin/entry-route";
export const dynamic="force-dynamic";
export default async function AdminEntry({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){
 await requireEstateAdmin();
 redirect(adminEntryRoute(await searchParams));
}
