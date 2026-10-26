import Link from "next/link";
import type {Metadata} from "next";
import {requireEstateAdmin} from "../../../lib/security/estate-properties";
import WorkspaceNavigation from "./WorkspaceNavigation";
import styles from "./workspace.module.css";
export const metadata:Metadata={robots:{index:false,follow:false},title:"MZS Group | Administration"};
export const dynamic="force-dynamic";
/** Server-verified group administrator access; every child page checks again. */
export default async function WorkspaceLayout({children}:{children:React.ReactNode}){
 await requireEstateAdmin();
 return <main className={styles.shell}>
  <div className={styles.content}>
   <header className={styles.header}>
    <Link href="/admin/workspaces/group" className={styles.brand}>MZS GROUP</Link>
    <span className={styles.headerTag}>Private Administration</span>
    <div className={styles.headerLinks}><Link href="/admin">Legacy administration</Link><Link href="/">Public website</Link></div>
   </header>
   <WorkspaceNavigation/>
   {children}
   <footer className={styles.note}>PRIVATE · INDEPENDENT · INTERNATIONAL — Administrative access is subject to existing MZS Group permissions.</footer>
  </div>
 </main>;
}
