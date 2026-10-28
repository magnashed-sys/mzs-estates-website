import Link from "next/link";
import {requireEstateAdmin} from "../../../../lib/security/estate-properties";
import styles from "../workspace.module.css";
export const dynamic="force-dynamic";
export default async function Workspace(){
 await requireEstateAdmin();
 return <><section className={styles.intro}><h1 className={styles.heading}>Staff</h1><p className={styles.lead}>Alle medewerkerszaken bij elkaar: toegang, werkbezoeken, uren, beoordelingen en correcties.</p></section>
 <section className={styles.grid} aria-label="Staff workflows">
   <Link className={styles.card} href="/admin/workspaces/estates/staff#staff-access"><strong>Medewerkers & objecttoegang</strong><p>Wijs objecten toe en controleer de vastgelegde toegang per medewerker.</p><span>Open →</span></Link>
   <Link className={styles.card} href="/admin/workspaces/estates/staff"><strong>Werkbezoeken & urenregister</strong><p>Bekijk geregistreerd werk, beoordelingen en de historie per medewerker en object.</p><span>Open →</span></Link>
   <Link className={styles.card} href="/admin/workspaces/estates/actions?queue=visits"><strong>Uren beoordelen</strong><p>Beoordeel nieuwe werkbezoeken die nog op een beslissing wachten.</p><span>Open →</span></Link>
   <Link className={styles.card} href="/admin/workspaces/estates/actions?queue=corrections"><strong>Uurcorrecties</strong><p>Behandel correctieverzoeken met behoud van de oorspronkelijke registratie.</p><span>Open →</span></Link>
   <Link className={styles.card} href="/admin/workspaces/estates/time-report"><strong>Urenrapportage</strong><p>Filter op periode, medewerker en object en download de volledige selectie als CSV.</p><span>Open →</span></Link>
   <Link className={styles.card} href="/admin/workspaces/estates/history"><strong>Historische medewerkersopgaven</strong><p>Bekijk kostenopgaven en gekoppelde facturen in Accountancy; factuururen blijven apart van werkelijk geregistreerde uren.</p><span>Open →</span></Link>
 </section></>;
}
