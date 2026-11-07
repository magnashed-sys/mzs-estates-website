import {requireEstateAdmin} from "../../../lib/security/estate-properties";
export default async function BookingsLayout({children}:{children:React.ReactNode}){
 await requireEstateAdmin();
 return <>{children}</>;
}
