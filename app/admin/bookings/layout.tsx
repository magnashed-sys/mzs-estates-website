import WorkspaceNavigation from "../workspaces/WorkspaceNavigation";
import {requireEstateAdmin} from "../../../lib/security/estate-properties";
export default async function BookingsLayout({children}:{children:React.ReactNode}){
 await requireEstateAdmin();
 return <><div style={{background:"#0d0d0c",padding:"18px clamp(18px,4vw,60px)"}}><WorkspaceNavigation/></div>{children}</>;
}
