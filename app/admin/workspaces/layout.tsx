
import {getAdminI18n} from '../../../lib/admin/i18n-server';
import type {Metadata} from "next";
import {requireEstateAdmin} from "../../../lib/security/estate-properties";
import styles from "./workspace.module.css";
export const metadata:Metadata={robots:{index:false,follow:false},title:"MZS Group | Administration"};
export const dynamic="force-dynamic";
/** Server-verified group administrator access; every child page checks again. */
export default async function WorkspaceLayout({children}:{children:React.ReactNode}){
 const {t:adminT}=await getAdminI18n();

 await requireEstateAdmin();
 return <main className={styles.shell}>
  <div className={styles.content}>
   {children}
   <footer className={styles.note}>{adminT("PRIVATE · INDEPENDENT · INTERNATIONAL — Administrative access is subject to existing MZS Group permissions.")}</footer>
  </div>
 </main>;
}
