import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireEstateAdmin } from '../../../../../../lib/security/estate-properties';
import { euros, rentSummary } from '../../../../../../lib/estates/rent';
import s from '../estates.module.css';

export const dynamic = 'force-dynamic';

const unitTypes: Record<string, string> = { studio: 'Studio', room: 'Room', apartment: 'Apartment', other: 'Other' };

export default async function EstateProperty({ params }: { params: Promise<{ id: string }> }) {
  const { db } = await requireEstateAdmin();
  const { id } = await params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) notFound();
  const { data: property, error } = await db.from('mzs_estate_properties')
    .select('id,name,address,city,country_code,owner_name,ownership_kind,rent_basis,notes,source_reference')
    .eq('id', id).maybeSingle();
  if (error) return <p className={s.error} role="alert">The property is unavailable. Please try again later.</p>;
  if (!property) notFound();
  const [unitsResult, auditResult] = await Promise.all([
    db.from('mzs_estate_units').select('id,address,unit_type,tenant_name,monthly_rent,utilities_advance,sort_order')
      .eq('property_id', id).order('sort_order').order('address'),
    db.from('mzs_estate_audit').select('id,action,created_at,source_reference')
      .eq('property_id', id).order('created_at', { ascending: false }).limit(20),
  ]);
  const units = unitsResult.data || [];
  const totals = rentSummary(units);
  return <>
    <p className="mzsEyebrow">MZS ESTATES / OWNERSHIP &amp; UNITS</p>
    <h1>{property.name}</h1>
    <p className="mzsIntro">{property.address}<br />{property.city} · {property.country_code}</p>
    <section className={s.section} aria-labelledby="ownership-heading">
      <h2 id="ownership-heading">Ownership</h2>
      <p>{property.owner_name} · {property.ownership_kind === 'personal' ? 'Personal ownership' : 'Company ownership'}</p>
      {property.notes && <p className={s.note}>{property.notes}</p>}
    </section>
    <section className={s.section} aria-labelledby="units-heading">
      <h2 id="units-heading">Units &amp; rent</h2>
      {unitsResult.error ? <p className={s.error} role="alert">Units and rental totals are unavailable. Please try again later.</p> : <>
        <dl className={s.facts}>
          <div><dt>Units</dt><dd>{units.length}</dd></div>
          <div><dt>Monthly rent</dt><dd>{euros(totals.monthly)}</dd></div>
          <div><dt>Annual rent · 12 × monthly</dt><dd>{euros(totals.annual)}</dd></div>
          <div><dt>Monthly utilities advance</dt><dd>{totals.utilitiesAdvance === null ? 'Not provided' : euros(totals.utilitiesAdvance)}</dd></div>
        </dl>
        <p className={s.note}>{property.rent_basis}</p>
        {units.length > 0 && <div className={s.tableWrap} role="region" aria-label="Units and monthly rental amounts" tabIndex={0}>
          <table className={s.table}>
            <thead><tr><th scope="col">Unit / address</th><th scope="col">Recorded tenant</th><th scope="col" className={s.money}>Monthly rent</th><th scope="col" className={s.money}>Annual rent</th></tr></thead>
            <tbody>{units.map(unit => <tr key={unit.id}>
              <td>{unit.address}<span className={s.type}>{unitTypes[unit.unit_type] || unit.unit_type}</span></td>
              <td>{unit.tenant_name || 'Not provided'}</td>
              <td className={s.money}>{euros(unit.monthly_rent)}</td>
              <td className={s.money}>{euros(Math.round(Number(unit.monthly_rent) * 100) * 12 / 100)}</td>
            </tr>)}</tbody>
            <tfoot><tr><th scope="row" colSpan={2}>Total</th><td className={s.money}>{euros(totals.monthly)}</td><td className={s.money}>{euros(totals.annual)}</td></tr></tfoot>
          </table>
        </div>}
      </>}
    </section>
    <section className={s.section} aria-labelledby="source-heading">
      <h2 id="source-heading">Source &amp; history</h2>
      <p className={s.note}>{property.source_reference}</p>
      {auditResult.error ? <p role="alert">History unavailable.</p> : <p className={s.note}>
        {auditResult.data?.length || 0} recent records. {auditResult.data?.[0] && `Last recorded: ${new Intl.DateTimeFormat('en-GB', { dateStyle: 'long', timeZone: 'Europe/Amsterdam' }).format(new Date(auditResult.data[0].created_at))}.`}
        {' '}The complete creation and change history is retained.
      </p>}
    </section>
    <Link href="/admin/group/estates/properties">← Ownership &amp; units</Link>
  </>;
}
