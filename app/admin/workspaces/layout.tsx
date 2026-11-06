
import {getAdminI18n} from '../../../lib/admin/i18n-server';
import Link from "next/link";
import type {Metadata} from "next";
import {requireEstateAdmin} from "../../../lib/security/estate-properties";
import WorkspaceNavigation from "./WorkspaceNavigation";
import AdminDirectory from "../AdminDirectory";
import AdminLanguageSwitcher from "../AdminLanguageSwitcher";
import styles from "./workspace.module.css";
export const metadata:Metadata={robots:{index:false,follow:false},title:"MZS Group | Administration"};
export const dynamic="force-dynamic";
/** Server-verified group administrator access; every child page checks again. */
export default async function WorkspaceLayout({children}:{children:React.ReactNode}){
 const {t:adminT}=await getAdminI18n();

 await requireEstateAdmin();
 return <main className={styles.shell}>
  <div className={styles.content}>
   <header className={styles.header}>
    <div className={styles.identity}><Link href="/admin/workspaces/group" className={styles.brand}>{adminT("MZS GROUP")}</Link><span className={styles.headerTag}>{adminT("Private Administration")}</span></div>
    <div className={styles.headerLinks}><Link href="/admin/accounts">{adminT("Account requests")}</Link><Link href="/" target="_blank" rel="noopener noreferrer">{adminT("Public website ↗")}</Link><AdminLanguageSwitcher compact/></div>
   </header>
   <div className={styles.modules}><AdminDirectory/></div>
   <WorkspaceNavigation/>
   {children}
   <footer className={styles.note}>{adminT("PRIVATE · INDEPENDENT · INTERNATIONAL — Administrative access is subject to existing MZS Group permissions.")}</footer>
  </div>
 </main>;
}
