import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireEstateAdmin } from '../../../../../../lib/security/estate-properties';
import { euros, rentSummary } from '../../../../../../lib/estates/rent';
import s from '../estates.module.css';

export const dynamic = 'force-dynamic';

const unitTypes: Record<string, string> = { studio: 'Studio', room: 'Room', apartment: 'Apartment', office: 'Office', other: 'Other' };

export default async function EstateProperty({ params }: { params: Promise<{ id: string }> }) {
  const { db } = await requireEstateAdmin();
  const { id } = await params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) notFound();
  const { data: property, error } = await db.from('mzs_estate_properties')
    .select('id,name,address,city,country_code,owner_name,ownership_kind,ownership_since_year,managing_agent_name,managing_agent_url,managing_agent_logo,rent_basis,notes,source_reference')
    .eq('id', id).maybeSingle();
  if (error) return <p className={s.error} role="alert">The property is unavailable. Please try again later.</p>;
  if (!property) notFound();
  const [unitsResult, auditResult, imagesResult] = await Promise.all([
    db.from('mzs_estate_units').select('id,address,unit_type,tenant_name,monthly_rent,rent_included,utilities_advance,sort_order')
      .eq('property_id', id).order('sort_order').order('address'),
    db.from('mzs_estate_audit').select('id,action,created_at,source_reference')
      .eq('property_id', id).order('created_at', { ascending: false }).limit(20),
    db.from('mzs_estate_images').select('id,caption,image_base64,sort_order')
      .eq('property_id', id).order('sort_order').limit(20),
  ]);
  const units = unitsResult.data || [];
  const totals = rentSummary(units);
  return <>
    <p className="mzsEyebrow">MZS ESTATES / OWNERSHIP &amp; UNITS</p>
    <h1>{property.name}</h1>
    <p className="mzsIntro">{property.address}<br />{property.city} · {property.country_code}</p>
    {imagesResult.error ? <p role="alert" className={s.note}>Property photographs are temporarily unavailable.</p> :
      (imagesResult.data?.length ?? 0) > 0 && <section className={s.gallery} aria-label="Property photographs">
        {imagesResult.data!.map((photo, index) => <figure key={photo.id}>
          <img src={`data:image/webp;base64,${photo.image_base64}`} alt={photo.caption} width={900} height={1200} loading={index === 0 ? 'eager' : 'lazy'} />
          <figcaption>{photo.caption}</figcaption>
        </figure>)}
      </section>}
    <section className={s.section} aria-labelledby="ownership-heading">
      <h2 id="ownership-heading">Ownership</h2>
      <p>{property.owner_name} · {property.ownership_kind === 'personal' ? 'Personal ownership' : 'Company ownership'}</p>
      <dl className={s.ownershipFacts}>
        <div><dt>Owned since</dt><dd>{property.ownership_since_year ?? 'Not provided'}</dd></div>
        <div><dt>Managing agent</dt><dd>{property.managing_agent_name || 'Not provided'}</dd></div>
      </dl>
      {property.managing_agent_url?.startsWith('https://') && <a className={s.agentCard} href={property.managing_agent_url} target="_blank" rel="noopener noreferrer" aria-label={`Visit ${property.managing_agent_name || 'managing agent'} website (opens in a new tab)`}>
        {property.managing_agent_logo === 'kramer-and-partners' && <span className={s.agentLogo}><img src="/partners/kramer-and-partners.svg" alt="Kramer & Partners" width={251} height={90} /></span>}
        <span>Visit website ↗</span>
      </a>}
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
              <td><Link className={s.link} href={`/admin/group/estates/units/${unit.id}`}>{unit.address}</Link><span className={s.type}>{unitTypes[unit.unit_type] || unit.unit_type}</span></td>
              <td>{unit.tenant_name || 'Not provided'}</td>
              <td className={s.money}>{unit.rent_included ? 'Included*' : euros(unit.monthly_rent)}</td>
              <td className={s.money}>{unit.rent_included ? 'Included*' : euros(Math.round(Number(unit.monthly_rent) * 100) * 12 / 100)}</td>
            </tr>)}</tbody>
            <tfoot><tr><th scope="row" colSpan={2}>Total</th><td className={s.money}>{euros(totals.monthly)}</td><td className={s.money}>{euros(totals.annual)}</td></tr></tfoot>
          </table>
        </div>}
        {units.some(unit => unit.rent_included) && <p className={s.note}>* Rent is included in another unit’s rent. No separate rent is added to the totals.</p>}
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
