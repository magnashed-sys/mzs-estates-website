import {createClient} from '../../lib/supabase/server';
import {isPhase3aPreviewIsolated} from '../../lib/security/phase3a-preview-isolation';
import AdminHeaderControls from './AdminHeaderControls';

/** Navigation visibility only. Every page retains its own access checks. */
export default async function AdminHeader() {
  if (!isPhase3aPreviewIsolated()) return null;
  const db = await createClient();
  const {data: {user}, error} = await db.auth.getUser();
  if (error || !user) return null;
  const {data: profile, error: profileError} = await db.from('profiles')
    .select('role,is_active').eq('id', user.id).single();
  if (profileError || profile?.is_active !== true) return null;
  const groupAdmin = profile.role === 'admin';
  if (!groupAdmin) {
    const {data, error: scopeError} = await db.rpc('mzs_has_department_scope', {p_department: 'capital'});
    if (scopeError || data !== true) return null;
  }
  return <AdminHeaderControls groupAdmin={groupAdmin}/>;
}
