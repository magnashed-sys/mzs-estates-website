/** Server-only visibility: the public enquiry prototype must never appear in Production. */
export function isIntroCallPreviewEnabled(): boolean {
  return process.env.VERCEL_ENV === "preview"
    && process.env.NEXT_PUBLIC_SUPABASE_URL === "https://senonkpxdtlhyhrubicg.supabase.co";
}
