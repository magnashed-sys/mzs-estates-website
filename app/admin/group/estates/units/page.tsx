import Link from 'next/link';
import { requireEstateAdmin } from '../../../../../lib/security/estate-properties';
import {currentUnitContracts,contractNet} from '../../../../../lib/estates/unit-contracts';
import { euros } from '../../../../../lib/estates/rent';
import s from '../properties/estates.module.css';

export const dynamic = 'force-dynamic';
const types: Record<string, string> = { studio: 'Studio', room: 'Room', apartment: 'Apartment', office: 'Office', other: 'Other' };

export default async function RentalUnits() {
  const { db } = await requireEstateAdmin();
  const [properties, units, contracts] = await Promise.all([
    db.from('mzs_estate_properties').select('id,name,address').order('name'),
    db.from('mzs_estate_units').select('id,property_id,address,unit_type,tenant_name,monthly_rent,rent_included').order('sort_order').order('address'),
    db.from('mzs_lease_contracts').select('id,title,status,tenant_name,unit_ids,lease_start,lease_end,lines'),
  ]);
  const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Amsterdam',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  return <>
    <p className="mzsEyebrow">MZS ESTATES / MANAGEMENT</p>
    <h1>Rental units</h1>
    <p className="mzsIntro">Individual rental units, grouped by their property. Open a unit to view its details.</p>
    <p className={s.note}>Active contracts are the source for current tenancy. Units without an active contract show imported reference figures; these do not confirm availability.</p>
    {properties.error || units.error || contracts.error ? <p role="alert" className={s.error}>Rental units are unavailable. Please try again later.</p> :
      !units.data?.length ? <p>No rental units have been registered yet.</p> :
        properties.data?.map(property => {
          const linked = units.data.filter(unit => unit.property_id === property.id);
          if (!linked.length) return null;
          return <section key={property.id} className={s.section}>
            <h2><Link href={`/admin/group/estates/properties/${property.id}`}>{property.name}</Link></h2>
            <p>{property.address} · {linked.length} units</p>
            <div className="mzsCards">{linked.map(unit => <Link key={unit.id} href={`/admin/group/estates/units/${unit.id}`}>
              <small>{types[unit.unit_type] || unit.unit_type}</small><h3>{unit.address}</h3>
              {currentUnitContracts(contracts.data||[],unit.id,today).length?currentUnitContracts(contracts.data||[],unit.id,today).map(c=><div key={c.id}><p>{c.tenant_name}</p><p>{euros(contractNet(c))} net / month{c.unit_ids.length>1?' · entire multi-unit agreement':''}</p></div>):<><p>{unit.tenant_name||'No tenant recorded'} · imported reference</p><p>{unit.rent_included?'Rent included in another unit':`${euros(unit.monthly_rent)} / month · imported reference`}</p></>}
              <span>View rental unit →</span>
            </Link>)}</div>
          </section>;
        })}
    <Link href="/admin/group/estates">← Property cockpit</Link>
  </>;
}
