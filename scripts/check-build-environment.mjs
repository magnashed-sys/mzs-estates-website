import nextEnv from '@next/env';
const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());
const env=process.env;
const expected={preview:'https://senonkpxdtlhyhrubicg.supabase.co',production:'https://ptrnjzmcehrhbsfxntgw.supabase.co'};
if(!env.NEXT_PUBLIC_SUPABASE_URL || !env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) throw new Error('Missing Supabase URL or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY');
if(expected[env.VERCEL_ENV] && env.NEXT_PUBLIC_SUPABASE_URL !== expected[env.VERCEL_ENV]) throw new Error('Supabase project does not match deployment environment');
console.log('Build environment checks passed.');
