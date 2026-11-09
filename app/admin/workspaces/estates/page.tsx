
import {getAdminI18n} from '../../../../lib/admin/i18n-server';
import {Suspense} from "react";
import Link from "next/link";
import {requireEstateAdmin} from "../../../../lib/security/estate-properties";
import OperationsActionCenter from "../../OperationsActionCenter";
import {readRegister} from "../../../../lib/estates/read-register";
import {activeLeaseValue} from "../../../../lib/estates/active-lease-value";
import styles from "../workspace.module.css";
export const dynamic="force-dynamic";
export default async function EstatesWorkspace(){
 const {t:adminT,locale:adminLocale,language}=await getAdminI18n();
 const l=(en:string,es:string)=>language==='es'?es:en;
 const today=new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Amsterdam',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());

 const {db}=await requireEstateAdmin();
 const entityLinksAvailable=(process.env.VERCEL_ENV==="production" &&
  process.env.NEXT_PUBLIC_SUPABASE_URL==="https://ptrnjzmcehrhbsfxntgw.supabase.co") ||
  (process.env.VERCEL_ENV==="preview" &&
  process.env.NEXT_PUBLIC_SUPABASE_URL==="https://senonkpxdtlhyhrubicg.supabase.co");
 const [properties,units,contracts,contractRegister,adjustmentRegister]=await Promise.all([
  db.from("mzs_estate_properties").select("id",{count:"exact",head:true}),
  db.from("mzs_estate_units").select("id",{count:"exact",head:true}),
  db.from("mzs_lease_contracts").select("id",{count:"exact",head:true}),
  readRegister(db,'mzs_lease_contracts').then(data=>({data,error:null})).catch(error=>({data:null,error})),
  readRegister(db,'mzs_lease_adjustments').then(data=>({data,error:null})).catch(error=>({data:null,error}))
 ]);
 const counts=[
  {label:"Registered properties",result:properties},
  {label:"Registered units",result:units},
  {label:"Rental contracts",result:contracts}
 ];
 const unavailable=counts.filter(x=>x.result.error||x.result.count===null);
 // Fail closed on incomplete data: never present a partial monetary total.
 const snapshot=contractRegister.data&&adjustmentRegister.data
  ?activeLeaseValue(contractRegister.data,adjustmentRegister.data,today):null;
 const rentAvailable=Boolean(snapshot?.complete);
 const asEuros=(cents:number)=>new Intl.NumberFormat(adminLocale,{style:'currency',currency:'EUR'}).format(cents/100);
 return <>
  <section className={styles.intro}>
   <p className={styles.kicker}>{adminT("MZS ESTATES / PROPERTY COCKPIT")}</p>
   <h1 className={styles.heading}>{adminT("Real Estate.")}</h1>
   <p className={styles.lead}>{adminT("Property holdings, rentable units, rental contracts and booking workflows. Each register loads in its own dedicated administration route; no client-account or Capital dossier list is loaded here.")}</p>
  </section>
  {unavailable.length>0&&<p className={styles.error} role="alert">{adminT("Some property counts could not be verified (")}{unavailable.map(x=>x.label).join(", ")}{adminT("). No incomplete totals are presented for those sections.")}</p>}
  <section className={styles.stats} aria-label={adminT("Estates register counts")}>
   {counts.map(x=><div className={styles.stat} key={x.label}>
    <small>{adminT(x.label)}</small><strong>{x.result.error||x.result.count===null?adminT("Unavailable"):x.result.count}</strong>
   </div>)}
   <div className={`${styles.stat} ${styles.rentStat}`}>
    <small>{l('Monthly contractual rent value','Valor mensual de contratos de alquiler')}</small>
    <strong>{rentAvailable?asEuros(snapshot!.monthlyCents):adminT('Unavailable')}</strong>
   </div>
   <div className={`${styles.stat} ${styles.rentStat}`}>
    <small>{l('Annualized contractual rent value','Valor anualizado de contratos de alquiler')}</small>
    <strong>{rentAvailable?asEuros(snapshot!.annualizedCents):adminT('Unavailable')}</strong>
   </div>
  </section>
  <p className={styles.note}>{l('Values reflect contracts in force today, using approved price changes and recurring lines excluding VAT. The annual amount is 12 × the current monthly amount, not a forecast or received payments.','Los valores reflejan los contratos vigentes hoy, con cambios de precio aprobados y conceptos recurrentes sin IVA. El importe anual es 12 × el importe mensual actual; no es una previsión ni pagos recibidos.')}</p>
  {snapshot&&snapshot.unclassifiedContracts>0&&<p className={styles.note}>{l('Some contracts have no confirmed rent/advance breakdown. Their full monthly contract charges (including any advances) are included in these values, so they must not be read as base rent alone.','Algunos contratos no tienen un desglose confirmado entre alquiler y anticipos. Se incluyen todos sus conceptos mensuales (incluidos posibles anticipos), por lo que las cifras no representan únicamente la renta base.')}</p>}
  <Suspense fallback={<p role="status">{adminT("Loading action list…")}</p>}><OperationsActionCenter db={db} scope="maintenance"/></Suspense>
  <section className={styles.grid} aria-label={adminT("Property workflows")}>
   <Link className={styles.card} href="/admin/workspaces/accountancy/performance"><small>{l("05 / FINANCIAL REVIEW","05 / REVISIÓN FINANCIERA")}</small><strong>{l("Property & project figures","Cifras por inmueble y proyecto")}</strong><p>{l("Issued invoices, reviewed cost concepts and monthly comparisons, with verified allocations only.","Facturas emitidas, borradores revisados y comparaciones mensuales solo con asignaciones verificadas.")}</p><span>{l("Open property report →","Abrir informe de inmuebles →")}</span></Link>
   <Link className={styles.card} href="/admin/workspaces/estates/actions?queue=triage"><small>{adminT("MAINTENANCE")}</small><strong>{adminT("Reports, planning & work orders")}</strong><p>{adminT("Follow up on maintenance, assigned staff, quotations and budget decisions.")}</p><span>{adminT("Open maintenance →")}</span></Link>
   <Link className={styles.card} href="/admin/group/estates/properties"><small>{adminT("01 / PROPERTY REGISTER")}</small><strong>{adminT("Properties & ownership")}</strong><p>{adminT("Legal ownership, managing agents and property records.")}</p><span>{adminT("Open property register →")}</span></Link>
   <Link className={styles.card} href="/admin/group/estates/units"><small>{adminT("02 / UNIT MANAGEMENT")}</small><strong>{adminT("Rental units")}</strong><p>{adminT("Rentable units, linked contracts and recorded rental amounts.")}</p><span>{adminT("Open rental units →")}</span></Link>
   <Link className={styles.card} href="/admin/group/estates/contracts"><small>{adminT("03 / RENTAL ADMINISTRATION")}</small><strong>{adminT("Contracts & invoices")}</strong><p>{adminT("Tenants, agreements, invoicing entities and billing control.")}</p><span>{adminT("Open contracts →")}</span></Link>
   {entityLinksAvailable&&<Link className={styles.card} href="/admin/workspaces/estates/entities">
    <small>{adminT("04 / ACCOUNTANCY PREPARATION")}</small>
    <strong>{adminT("Properties & legal entities")}</strong>
    <p>{adminT("Record the verified legal owner, cost bearer or manager with supporting evidence and an effective date.")}</p>
    <span>{adminT("Open legal property associations →")}</span>
   </Link>}
   <Link className={styles.card} href="/admin/projects"><small>{adminT("09 / PROJECT PRESENTATIONS")}</small><strong>{adminT("Projects & access")}</strong><p>{adminT("Private listings, project materials and client permissions.")}</p><span>{adminT("Manage projects →")}</span></Link>
  </section>
  <p className={styles.note}>{l('The first three figures count registered records; the last two reflect recurring values from currently effective contracts. These are not collected receipts.','Las tres primeras cifras cuentan registros; las dos últimas reflejan importes recurrentes de contratos vigentes. No son cobros recibidos.')}</p>
 </>;
}
