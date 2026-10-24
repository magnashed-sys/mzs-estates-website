import Link from 'next/link';
import { requireContractAdmin } from '../../../../../lib/security/estate-contracts';
import ContractWorkspace from './workspace';
export const dynamic='force-dynamic';
export default async function ContractsPage() {
  const {db}=await requireContractAdmin();
  const results=await Promise.all([
    db.from('mzs_estate_properties').select('id,name,owner_name,address').order('name'),
    db.from('mzs_estate_units').select('id,property_id,address,tenant_name,monthly_rent,utilities_advance,rent_included').order('sort_order'),
    db.from('profiles').select('id,full_name,email').order('full_name'),
    db.from('mzs_lease_contracts').select('*').order('created_at',{ascending:false}),
    db.from('mzs_lease_relationships').select('*').order('name'),
    db.from('mzs_lease_invoice_drafts').select('*').order('period_start',{ascending:false}).limit(500),
  ]);
  if(results.some(r=>r.error)) return <><h1>Contracts</h1><p role="alert">The contract register could not be loaded. Please try again later.</p></>;
  return <><p className="mzsEyebrow">MZS ESTATES / LONG-TERM RENTAL</p><h1>Contracts &amp; invoices.</h1>
    <p className="mzsIntro">Link your rental units, record the agreement and prepare monthly invoice drafts for review.</p>
    <ContractWorkspace properties={results[0].data || []} units={results[1].data || []} members={results[2].data || []} contracts={results[3].data || []} relationships={results[4].data || []} invoices={results[5].data || []}/>
    <Link href="/admin?tab=contracts">← Rental Contracts overview</Link></>;
}
