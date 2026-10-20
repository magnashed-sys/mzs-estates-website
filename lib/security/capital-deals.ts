import { notFound, redirect } from 'next/navigation';
import { createClient } from '../supabase/server';

export function capitalDealsPreviewEnabled() {
  return process.env.VERCEL_ENV === 'preview' &&
    process.env.NEXT_PUBLIC_SUPABASE_URL === 'https://senonkpxdtlhyhrubicg.supabase.co';
}

// Call in each page, action and route: parent layouts do not protect actions.
export async function requireDealsAdmin() {
  if (!capitalDealsPreviewEnabled()) notFound();
  const db = await createClient();
  const { data: { user }, error } = await db.auth.getUser();
  if (error || !user) redirect('/login');
  const { data: profile, error: profileError } = await db.from('profiles')
    .select('role,is_active').eq('id',user.id).single();
  if (profileError || profile?.role !== 'admin' || profile.is_active !== true) notFound();
  return { db, user };
}
