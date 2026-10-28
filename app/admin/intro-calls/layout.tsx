import WorkspaceNavigation from "../workspaces/WorkspaceNavigation";
import {requireEstateAdmin} from "../../../lib/security/estate-properties";
export default async function Layout({children}:{children:React.ReactNode}){
 await requireEstateAdmin();
 return <><div style={{padding:"18px clamp(18px,4vw,60px)",background:"#0d0d0c"}}><WorkspaceNavigation/></div>{children}</>;
}
