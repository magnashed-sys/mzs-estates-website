import { notFound } from 'next/navigation';
import { requireEstateAdmin } from './estate-properties';

// This first release is available only in the isolated Staging deployment.
export function contractsAvailable() {
  return process.env.VERCEL_ENV === 'preview'
    && process.env.NEXT_PUBLIC_SUPABASE_URL === 'https://senonkpxdtlhyhrubicg.supabase.co';
}
export async function requireContractAdmin() {
  if (!contractsAvailable()) notFound();
  return requireEstateAdmin();
}
