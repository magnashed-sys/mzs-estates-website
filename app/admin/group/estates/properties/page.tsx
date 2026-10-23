import Link from 'next/link';
import { requireEstateAdmin } from '../../../../../lib/security/estate-properties';
import { euros, rentSummary } from '../../../../../lib/estates/rent';
import s from './estates.module.css';

export const dynamic = 'force-dynamic';

export default async function EstateProperties() {
  const { db } = await requireEstateAdmin();
  const { data, error } = await db.from('mzs_estate_properties')
    .select('id,name,address,city,country_code,owner_name,ownership_kind,mzs_estate_units(monthly_rent,utilities_advance)')
    .order('created_at', { ascending: false });
  return <>
    <p className="mzsEyebrow">MZS ESTATES / MANAGEMENT</p>
    <h1>Ownership &amp; units</h1>
    <p className="mzsIntro">Property ownership, individual units and recorded rental amounts.</p>
    {error ? <p className={s.error} role="alert">The property register is unavailable. Please try again later.</p> :
      !data?.length ? <p className="mzsIntro">No properties have been registered yet.</p> :
        <section className="mzsCards">{data.map(property => {
          const totals = rentSummary(property.mzs_estate_units);
          return <Link key={property.id} href={`/admin/group/estates/properties/${property.id}`}>
            <small>{property.city} · {property.country_code}</small>
            <h2>{property.name}</h2><p>{property.address}</p>
            <p>{property.owner_name} · {property.ownership_kind === 'personal' ? 'Personal ownership' : 'Company ownership'}</p>
            <p>{property.mzs_estate_units.length} units · {euros(totals.monthly)} / month</p>
            <span>View property &amp; units →</span>
          </Link>;
        })}</section>}
    <Link href="/admin/group/estates">← Property cockpit</Link>
  </>;
}
