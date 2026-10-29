
import {getAdminI18n} from '../../../lib/admin/i18n-server';
import Link from 'next/link';
import {requireEstateAdmin} from '../../../lib/security/estate-properties';
import {readRegister} from '../../../lib/estates/read-register';
import RelationshipRegister from './RelationshipRegister';
import '../admin.css';

export const dynamic = 'force-dynamic';
export default async function RelationshipsPage({searchParams}: {searchParams: Promise<Record<string, string | string[] | undefined>>}) {
 const {t:adminT,locale:adminLocale}=await getAdminI18n();

  const {db} = await requireEstateAdmin();
  const params = await searchParams;
  const [records, members] = await Promise.all([
    readRegister(db, 'mzs_lease_relationships'),
    db.from('profiles').select('id,full_name,email,role,is_active', {count:'exact'}).in('role', ['client', 'partner']).order('full_name'),
  ]);
  if (members.error || members.count !== members.data?.length) throw new Error('The complete relationship register could not be loaded.');
  return <main className="admin-page">
    <header className="admin-header"><Link className="admin-brand" href="/admin">{adminT("MZS GROUP")}</Link><Link className="admin-button" href="/admin?tab=relationships">{adminT("← Administration")}</Link></header>
    <section className="admin-content">
      <p className="eyebrow">{adminT("MZS Group / Relationships")}</p><h1>{adminT("Clients & companies.")}</h1>
      <p className="admin-intro">{adminT("One relationship, with the roles and agreements that apply. A tenant is an existing relationship with a rental contract.")}</p>
      <RelationshipRegister relationships={records} members={members.data || []}
        initialKind={params.new === 'company' ? 'company' : 'person'}
        createInitially={params.new === 'person' || params.new === 'company'}
        initialEdit={typeof params.edit === 'string' ? params.edit : undefined}
        initialProfile={typeof params.profile === 'string' ? params.profile : undefined}
        initialFilter={params.kind === 'company' ? 'company' : 'all'} />
      <p><Link className="admin-button" href="/admin/group/estates/contracts">{adminT("Open rental contracts →")}</Link></p>
    </section>
  </main>;
}
