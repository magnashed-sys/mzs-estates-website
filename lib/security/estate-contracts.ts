import { notFound } from 'next/navigation';
import { requireEstateAdmin } from './estate-properties';

// Only matching deployment/database pairs may access the admin lease module.
export function contractsAvailable() {
  return (process.env.VERCEL_ENV === 'preview' && process.env.NEXT_PUBLIC_SUPABASE_URL === 'https://senonkpxdtlhyhrubicg.supabase.co')
    || (process.env.VERCEL_ENV === 'production' && process.env.NEXT_PUBLIC_SUPABASE_URL === 'https://ptrnjzmcehrhbsfxntgw.supabase.co');
}
export async function requireContractAdmin() {
  if (!contractsAvailable()) notFound();
  return requireEstateAdmin();
}
