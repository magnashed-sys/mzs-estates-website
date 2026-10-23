import { notFound, redirect } from 'next/navigation';
import { createClient } from '../supabase/server';
import { isPhase3aPreviewIsolated } from './phase3a-preview-isolation';

// Each route checks identity itself; the parent layout is not an access boundary.
export async function requireEstateAdmin() {
  if (!isPhase3aPreviewIsolated()) notFound();
  const db = await createClient();
  const { data: { user }, error } = await db.auth.getUser();
  if (error || !user) redirect('/login');
  const { data: profile, error: profileError } = await db.from('profiles')
    .select('role,is_active').eq('id', user.id).single();
  if (profileError || profile?.role !== 'admin' || profile.is_active !== true) notFound();
  return { db, user };
}
