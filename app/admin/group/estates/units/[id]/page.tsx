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
  const {data:contracts,error:contractError}=contractsAvailable()?await db.from('mzs_lease_contracts').select('id,title,status,tenant_name,unit_ids,lease_start,lease_end,lines').contains('unit_ids',[id]):{data:[],error:null};
  const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Amsterdam',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  const current=currentUnitContracts(contracts||[],id,today);
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
      <h2>Current contract</h2>{contractError?<p role="alert">Contracts could not be loaded. Current rent is unconfirmed.</p>:current.length?current.map(c=><div key={c.id}><p>{c.tenant_name} · {c.lease_start} — {c.lease_end||'open-ended'}</p><p>{euros(contractNet(c))} monthly net {c.unit_ids.length>1?`for the full agreement covering ${c.unit_ids.length} units; no per-unit allocation`:''}</p><Link href={`/admin/group/estates/contracts?contract=${c.id}`}>{c.title} →</Link></div>):<p>No active contract covering today is recorded.</p>}
      <h3>Imported reference figures</h3><p className={s.note}>The figures below are retained from the original unit register. A current contract above is the source for ongoing billing.</p>
      <dl className={s.facts}>
        <div><dt>Recorded tenant</dt><dd>{unit.tenant_name || 'Not provided'}</dd></div>
        <div><dt>Monthly rent</dt><dd>{unit.rent_included ? 'Included' : euros(unit.monthly_rent)}</dd></div>
        <div><dt>Annual rent · 12 × monthly</dt><dd>{unit.rent_included ? 'Included' : euros(Math.round(Number(unit.monthly_rent) * 100) * 12 / 100)}</dd></div>
        <div><dt>Monthly utilities advance</dt><dd>{unit.utilities_advance === null ? 'Not provided' : euros(unit.utilities_advance)}</dd></div>
      </dl>
      {unit.rent_included && <p className={s.note}>Rent is included in another unit’s rent. No separate rent is added to the property totals.</p>}
      <p className={s.note}>{property.rent_basis}</p>
      <p className={s.note}>Long-term agreements do not make this unit available for online holiday bookings.</p>
    </section>
    <section className={s.section}><h2>Contract history &amp; planned agreements</h2>{(contracts||[]).map(c=><p key={c.id}><Link href={`/admin/group/estates/contracts?contract=${c.id}`}>{c.title}</Link> · {c.status} · {c.lease_start} — {c.lease_end||'open-ended'}</p>)}<Link href={`/admin/group/estates/contracts?view=invoices&unit=${id}`}>Invoice drafts for this unit →</Link></section>
    <section className={s.section}><h2>Source</h2><p className={s.note}>{unit.source_reference}</p></section>
    {contractsAvailable() && <p><Link className={s.link} href="/admin/group/estates/contracts">Manage rental contracts &amp; invoice drafts →</Link></p>}
    <Link href="/admin/group/estates/units">← All rental units</Link>
  </>;
}
