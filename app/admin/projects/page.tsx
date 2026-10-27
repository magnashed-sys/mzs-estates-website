import AdminPanels from "../AdminPanels";
import {requireEstateAdmin} from "../../../lib/security/estate-properties";
export const dynamic="force-dynamic";
export default async function ManagementPage(){
 await requireEstateAdmin();
 
 return <AdminPanels key="projects" section="projects" />;
}
