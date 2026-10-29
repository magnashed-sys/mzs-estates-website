
import {getAdminI18n} from '../../../../../../lib/admin/i18n-server';
import Link from 'next/link';
import { contractsAvailable } from '../../../../../../lib/security/estate-contracts';
import { notFound } from 'next/navigation';
import { requireEstateAdmin } from '../../../../../../lib/security/estate-properties';
import {currentUnitContracts,contractNet} from '../../../../../../lib/estates/unit-contracts';
import { euros } from '../../../../../../lib/estates/rent';
import s from '../../properties/estates.module.css';

export const dynamic = 'force-dynamic';
const types: Record<string, string> = { studio: 'Studio', room: 'Room', apartment: 'Apartment', office: 'Office', other: 'Other' };

export default async function RentalUnit({ params }: { params: Promise<{ id: string }> }) {
 const {t:adminT,locale:adminLocale}=await getAdminI18n();

  const { db } = await requireEstateAdmin();
  const { id } = await params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) notFound();
  const { data: unit, error } = await db.from('mzs_estate_units')
    .select('id,property_id,address,unit_type,tenant_name,monthly_rent,rent_included,utilities_advance,source_reference')
    .eq('id', id).maybeSingle();
  if (error) return <p role="alert" className={s.error}>{adminT("The rental unit is unavailable. Please try again later.")}</p>;
  if (!unit) notFound();
  const { data: property, error: propertyError } = await db.from('mzs_estate_properties')
    .select('id,name,owner_name,ownership_kind,ownership_since_year,managing_agent_name,rent_basis')
    .eq('id', unit.property_id).maybeSingle();
  if (propertyError || !property) return <p role="alert" className={s.error}>{adminT("The linked property is unavailable. Please try again later.")}</p>;
  const {data:contracts,error:contractError}=contractsAvailable()?await db.from('mzs_lease_contracts').select('id,title,status,tenant_name,unit_ids,lease_start,lease_end,lines').contains('unit_ids',[id]):{data:[],error:null};
  const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Amsterdam',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  const current=currentUnitContracts(contracts||[],id,today);
  return <>
    <p className="mzsEyebrow">{adminT("MZS ESTATES / RENTAL UNITS")}</p>
    <h1>{unit.address}</h1>
    <p className="mzsIntro">{adminT(types[unit.unit_type] || unit.unit_type)}</p>
    <section className={s.section}>
      <h2>{adminT("Linked property")}</h2>
      <Link className={s.link} href={`/admin/group/estates/properties/${property.id}`}>{property.name} →</Link>
      <p>{property.owner_name} · {property.ownership_kind === 'personal' ? adminT("Personal ownership") : adminT("Company ownership")}</p>
      <dl className={s.ownershipFacts}>
        <div><dt>{adminT("Owned since")}</dt><dd>{property.ownership_since_year ?? adminT("Not provided")}</dd></div>
        <div><dt>{adminT("Managing agent")}</dt><dd>{property.managing_agent_name || adminT("Not provided")}</dd></div>
      </dl>
    </section>
    <section className={s.section}>
      <h2>{adminT("Current contract")}</h2>{contractError?<p role="alert">{adminT("Contracts could not be loaded. Current rent is unconfirmed.")}</p>:current.length?current.map(c=><div key={c.id}><p>{c.tenant_name} · {c.lease_start} — {c.lease_end||adminT("open-ended")}</p><p>{euros(contractNet(c), adminLocale)}  {adminT("monthly net")} {c.unit_ids.length>1?adminT("for the full agreement covering {p0} units; no per-unit allocation", {p0: c.unit_ids.length}):''}</p><Link href={`/admin/group/estates/contracts?contract=${c.id}`}>{c.title} →</Link></div>):<p>{adminT("No active contract covering today is recorded.")}</p>}
      <h3>{adminT("Imported reference figures")}</h3><p className={s.note}>{adminT("The figures below are retained from the original unit register. A current contract above is the source for ongoing billing.")}</p>
      <dl className={s.facts}>
        <div><dt>{adminT("Recorded tenant")}</dt><dd>{unit.tenant_name || adminT("Not provided")}</dd></div>
        <div><dt>{adminT("Monthly rent")}</dt><dd>{unit.rent_included ? adminT("Included") : euros(unit.monthly_rent, adminLocale)}</dd></div>
        <div><dt>{adminT("Annual rent · 12 × monthly")}</dt><dd>{unit.rent_included ? adminT("Included") : euros(Math.round(Number(unit.monthly_rent) * 100) * 12 / 100, adminLocale)}</dd></div>
        <div><dt>{adminT("Monthly utilities advance")}</dt><dd>{unit.utilities_advance === null ? adminT("Not provided") : euros(unit.utilities_advance, adminLocale)}</dd></div>
      </dl>
      {unit.rent_included && <p className={s.note}>{adminT("Rent is included in another unit’s rent. No separate rent is added to the property totals.")}</p>}
      <p className={s.note}>{adminT(property.rent_basis)}</p>
      <p className={s.note}>{adminT("Long-term agreements do not make this unit available for online holiday bookings.")}</p>
    </section>
    <section className={s.section}><h2>{adminT("Contract history & planned agreements")}</h2>{(contracts||[]).map(c=><p key={c.id}><Link href={`/admin/group/estates/contracts?contract=${c.id}`}>{c.title}</Link> · {adminT(c.status)} · {c.lease_start} — {c.lease_end||adminT("open-ended")}</p>)}<Link href={`/admin/group/estates/contracts?view=invoices&unit=${id}`}>{adminT("Invoice drafts for this unit →")}</Link></section>
    <section className={s.section}><h2>{adminT("Source")}</h2><p className={s.note}>{unit.source_reference}</p></section>
    {contractsAvailable() && <p><Link className={s.link} href="/admin/group/estates/contracts">{adminT("Manage rental contracts & invoice drafts →")}</Link></p>}
    <Link href="/admin/group/estates/units">{adminT("← All rental units")}</Link>
  </>;
}
