
import {getAdminI18n} from '../../../../../lib/admin/i18n-server';
import Link from 'next/link';
import { requireEstateAdmin } from '../../../../../lib/security/estate-properties';
import {currentUnitContracts,contractNet} from '../../../../../lib/estates/unit-contracts';
import { euros } from '../../../../../lib/estates/rent';
import s from '../properties/estates.module.css';

export const dynamic = 'force-dynamic';
const types: Record<string, string> = { studio: 'Studio', room: 'Room', apartment: 'Apartment', office: 'Office', other: 'Other' };

export default async function RentalUnits() {
 const {t:adminT,locale:adminLocale}=await getAdminI18n();

  const { db } = await requireEstateAdmin();
  const [properties, units, contracts] = await Promise.all([
    db.from('mzs_estate_properties').select('id,name,address').order('name'),
    db.from('mzs_estate_units').select('id,property_id,address,unit_type,tenant_name,monthly_rent,rent_included').order('sort_order').order('address'),
    db.from('mzs_lease_contracts').select('id,title,status,tenant_name,unit_ids,lease_start,lease_end,lines'),
  ]);
  const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Amsterdam',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  return <>
    <p className="mzsEyebrow">{adminT("MZS ESTATES / MANAGEMENT")}</p>
    <h1>{adminT("Rental units")}</h1>
    <p className="mzsIntro">{adminT("Individual rental units, grouped by their property. Open a unit to view its details.")}</p>
    <p className={s.note}>{adminT("Active contracts are the source for current tenancy. Units without an active contract show imported reference figures; these do not confirm availability.")}</p>
    {properties.error || units.error || contracts.error ? <p role="alert" className={s.error}>{adminT("Rental units are unavailable. Please try again later.")}</p> :
      !units.data?.length ? <p>{adminT("No rental units have been registered yet.")}</p> :
        properties.data?.map(property => {
          const linked = units.data.filter(unit => unit.property_id === property.id);
          if (!linked.length) return null;
          return <section key={property.id} className={s.section}>
            <h2><Link href={`/admin/group/estates/properties/${property.id}`}>{property.name}</Link></h2>
            <p>{property.address} · {linked.length}  {adminT("units")}</p>
            <div className="mzsCards">{linked.map(unit => <Link key={unit.id} href={`/admin/group/estates/units/${unit.id}`}>
              <small>{adminT(types[unit.unit_type] || unit.unit_type)}</small><h3>{unit.address}</h3>
              {currentUnitContracts(contracts.data||[],unit.id,today).length?currentUnitContracts(contracts.data||[],unit.id,today).map(c=><div key={c.id}><p>{c.tenant_name}</p><p>{euros(contractNet(c), adminLocale)}  {adminT("net / month")}{c.unit_ids.length>1?adminT(" · entire multi-unit agreement"):''}</p></div>):<><p>{unit.tenant_name||adminT("No tenant recorded")}  {adminT("· imported reference")}</p><p>{unit.rent_included?adminT("Rent included in another unit"):adminT("{p0} / month · imported reference", {p0: euros(unit.monthly_rent)})}</p></>}
              <span>{adminT("View rental unit →")}</span>
            </Link>)}</div>
          </section>;
        })}
    <Link href="/admin/group/estates">{adminT("← Property cockpit")}</Link>
  </>;
}
