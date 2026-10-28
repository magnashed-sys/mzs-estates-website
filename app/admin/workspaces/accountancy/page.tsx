import Link from "next/link";
import {requireEstateAdmin} from "../../../../lib/security/estate-properties";
import styles from "../workspace.module.css";
export const dynamic="force-dynamic";
export default async function Workspace(){
 await requireEstateAdmin();
 return <><section className={styles.intro}><h1 className={styles.heading}>Accountancy</h1><p className={styles.lead}>Kosten, uitgegeven facturen en financiële exports per juridische entiteit. Selecteer het register dat je wilt controleren.</p></section>
 <section className={styles.grid} aria-label="Accountancy workflows">
   <Link className={styles.card} href="/admin/workspaces/estates/expenses"><strong>Kostenregister</strong><p>Inkoopconcepten, leveranciers en kostenverdeling per object en unit.</p><span>Open →</span></Link>
   <Link className={styles.card} href="/admin/workspaces/estates/history"><strong>Historische weekopgaven</strong><p>Medewerkersopgaven met bronverwijzingen en reeds extern gefactureerde kosten.</p><span>Open →</span></Link>
   <Link className={styles.card} href="/admin/workspaces/estates/reports"><strong>Kostenrapportage & accountants-export</strong><p>Kosten per maand, object en categorie. Exporteer uitgegeven facturen en geregistreerde ontvangsten per entiteit.</p><span>Open →</span></Link>
   <Link className={styles.card} href="/admin/group/estates/contracts?view=invoices"><strong>Huurfacturen</strong><p>Uitgegeven huurcontractfacturen en bijbehorende ontvangsten.</p><span>Open →</span></Link>
   <Link className={styles.card} href="/admin/bookings#accountant-export"><strong>Boekingsadministratie</strong><p>Jaaroverzicht van boekingen; facturen en ontvangsten zijn beschikbaar in het boekingsdossier.</p><span>Open →</span></Link>
   <Link className={styles.card} href="/admin/workspaces/estates/entities"><strong>Juridische objectkoppelingen</strong><p>Controleer welke entiteit eigenaar, kostendrager of beheerder is.</p><span>Open →</span></Link>
 </section></>;
}
