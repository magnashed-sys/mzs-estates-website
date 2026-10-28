/** Default-OFF pilot environment contract. Never authorize by host header or browser flag. */
export type PilotEnvironment = "staging" | "production" | null;
export type PilotEnvironmentConfig = {
 VERCEL_ENV?: string;
 NEXT_PUBLIC_SUPABASE_URL?: string;
 VERCEL_GIT_COMMIT_SHA?: string;
 MZS_OPS_STAGING_PILOT_ENABLED?: string;
 MZS_OPS_PRODUCTION_PILOT_ENABLED?: string;
 MZS_OPS_PRODUCTION_PILOT_RELEASE_SHA?: string;
};
const staging = "https://senonkpxdtlhyhrubicg.supabase.co";
const production = "https://ptrnjzmcehrhbsfxntgw.supabase.co";
const commit = /^[a-f0-9]{40}$/i;

/** Caller must still check user, live property scope and database run status. */
export function resolvePilotEnvironment(config: PilotEnvironmentConfig): PilotEnvironment {
 if (config.VERCEL_ENV === "preview" &&
     config.NEXT_PUBLIC_SUPABASE_URL === staging &&
     config.MZS_OPS_STAGING_PILOT_ENABLED === "true") return "staging";
 if (config.VERCEL_ENV === "production" &&
     config.NEXT_PUBLIC_SUPABASE_URL === production &&
     config.MZS_OPS_PRODUCTION_PILOT_ENABLED === "true" &&
     typeof config.MZS_OPS_PRODUCTION_PILOT_RELEASE_SHA === "string" &&
     commit.test(config.MZS_OPS_PRODUCTION_PILOT_RELEASE_SHA) &&
     config.MZS_OPS_PRODUCTION_PILOT_RELEASE_SHA.toLowerCase() === config.VERCEL_GIT_COMMIT_SHA?.toLowerCase())
   return "production";
 return null;
}
