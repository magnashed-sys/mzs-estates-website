import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireEstateAdmin } from '../../../../../../lib/security/estate-properties';
import { euros } from '../../../../../../lib/estates/rent';
import s from '../../properties/estates.module.css';

export const dynamic = 'force-dynamic';
const types: Record<string, string> = { studio: 'Studio', room: 'Room', apartment: 'Apartment', office: 'Office', other: 'Other' };

export default async function RentalUnit({ params }: { params: Promise<{ id: string }> }) {
  const { db } = await requireEstateAdmin();
  const { id } = await params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) notFound();
  const { data: unit, error } = await db.from('mzs_estate_units')
    .select('id,property_id,address,unit_type,tenant_name,monthly_rent,rent_included,utilities_advance,source_reference')
    .eq('id', id).maybeSingle();
  if (error) return <p role="alert" className={s.error}>The rental unit is unavailable. Please try again later.</p>;
  if (!unit) notFound();
  const { data: property, error: propertyError } = await db.from('mzs_estate_properties')
    .select('id,name,owner_name,ownership_kind,ownership_since_year,managing_agent_name,rent_basis')
    .eq('id', unit.property_id).maybeSingle();
  if (propertyError || !property) return <p role="alert" className={s.error}>The linked property is unavailable. Please try again later.</p>;
  return <>
    <p className="mzsEyebrow">MZS ESTATES / RENTAL UNITS</p>
    <h1>{unit.address}</h1>
    <p className="mzsIntro">{types[unit.unit_type] || unit.unit_type}</p>
    <section className={s.section}>
      <h2>Linked property</h2>
      <Link className={s.link} href={`/admin/group/estates/properties/${property.id}`}>{property.name} →</Link>
      <p>{property.owner_name} · {property.ownership_kind === 'personal' ? 'Personal ownership' : 'Company ownership'}</p>
      <dl className={s.ownershipFacts}>
        <div><dt>Owned since</dt><dd>{property.ownership_since_year ?? 'Not provided'}</dd></div>
        <div><dt>Managing agent</dt><dd>{property.managing_agent_name || 'Not provided'}</dd></div>
      </dl>
    </section>
    <section className={s.section}>
      <h2>Tenancy &amp; rent</h2>
      <dl className={s.facts}>
        <div><dt>Recorded tenant</dt><dd>{unit.tenant_name || 'Not provided'}</dd></div>
        <div><dt>Monthly rent</dt><dd>{unit.rent_included ? 'Included' : euros(unit.monthly_rent)}</dd></div>
        <div><dt>Annual rent · 12 × monthly</dt><dd>{unit.rent_included ? 'Included' : euros(Math.round(Number(unit.monthly_rent) * 100) * 12 / 100)}</dd></div>
        <div><dt>Monthly utilities advance</dt><dd>{unit.utilities_advance === null ? 'Not provided' : euros(unit.utilities_advance)}</dd></div>
      </dl>
      {unit.rent_included && <p className={s.note}>Rent is included in another unit’s rent. No separate rent is added to the property totals.</p>}
      <p className={s.note}>{property.rent_basis}</p>
      <p className={s.note}>Current availability, lease dates and contract terms have not been registered. This unit is not offered for online booking.</p>
    </section>
    <section className={s.section}><h2>Source</h2><p className={s.note}>{unit.source_reference}</p></section>
    <Link href="/admin/group/estates/units">← All rental units</Link>
  </>;
}
