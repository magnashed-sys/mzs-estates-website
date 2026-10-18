/** Phase 3A must never access the Production database from Vercel Preview.
 * Use only on the server: do not trust request headers or client-side state
 * to identify deployment environment.
 */
const PHASE3A_STAGING_URL = "https://senonkpxdtlhyhrubicg.supabase.co";

export function isPhase3aPreviewIsolated(): boolean {
  if (process.env.VERCEL_ENV !== "preview") return true;
  return process.env.NEXT_PUBLIC_SUPABASE_URL === PHASE3A_STAGING_URL;
}
