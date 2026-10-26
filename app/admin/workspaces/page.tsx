import {redirect} from "next/navigation";
import {requireEstateAdmin} from "../../../lib/security/estate-properties";
export default async function WorkspaceIndex(){
 await requireEstateAdmin();
 redirect("/admin/workspaces/group");
}
