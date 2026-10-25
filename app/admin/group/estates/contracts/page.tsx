import Link from 'next/link';
import {readRegister} from '../../../../../lib/estates/read-register';
import { requireContractAdmin } from '../../../../../lib/security/estate-contracts';
import ContractWorkspace from './workspace';
export const dynamic='force-dynamic';
export default async function ContractsPage() {
  const {db}=await requireContractAdmin();
  const results=await Promise.all([
    db.from('mzs_estate_properties').select('id,name,owner_name,address').order('name'),
    db.from('mzs_estate_units').select('id,property_id,address,tenant_name,monthly_rent,utilities_advance,rent_included').order('sort_order'),
    db.from('profiles').select('id,full_name,email').order('full_name'),
    readRegister(db,'mzs_lease_contracts').then(data=>({data,error:null})).catch(error=>({data:[],error})),
    readRegister(db,'mzs_lease_relationships').then(data=>({data,error:null})).catch(error=>({data:[],error})),
    readRegister(db,'mzs_lease_invoice_drafts').then(data=>({data,error:null})).catch(error=>({data:[],error})),
    readRegister(db,'mzs_lease_issuers').then(data=>({data,error:null})).catch(error=>({data:[],error})),
    readRegister(db,'mzs_lease_invoices').then(data=>({data,error:null})).catch(error=>({data:[],error})),
    readRegister(db,'mzs_lease_payments').then(data=>({data,error:null})).catch(error=>({data:[],error})),
    db.from('mzs_member_companies').select('id,legal_name,trading_name,registration_number,country,user_id').order('legal_name'),
  ]);
  if(results.some(r=>r.error)) return <><h1>Contracts</h1><p role="alert">The contract register could not be loaded. Please try again later.</p></>;
  return <><p className="mzsEyebrow">MZS ESTATES / LONG-TERM RENTAL</p><h1>Contracts &amp; invoices.</h1>
    <p className="mzsIntro">Link your rental units, record the agreement and prepare monthly invoice drafts for review.</p>
    <ContractWorkspace companies={results[9].data || []} properties={results[0].data || []} units={results[1].data || []} members={results[2].data || []} contracts={results[3].data || []} relationships={results[4].data || []} invoices={results[5].data || []} issuers={results[6].data || []} issued={results[7].data || []} payments={results[8].data || []}/>
    <Link href="/admin?tab=contracts">← Rental Contracts overview</Link></>;
}
