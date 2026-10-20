// Server-only environment pairing; never derive trust from request headers.
export function capitalClientEnvironmentAllowed() {
 const environment=process.env.VERCEL_ENV;
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
 return (environment==='preview'&&url==='https://senonkpxdtlhyhrubicg.supabase.co') ||
  (environment==='production'&&url==='https://ptrnjzmcehrhbsfxntgw.supabase.co');
}
