import {createClient as createStorageClient} from '@supabase/supabase-js';
import {createClient} from '../../../../../lib/supabase/server';
import {privateVisualResponse} from '../../../../../lib/projects/private-visual-response';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(_request: Request, {params}: {params: Promise<{slug: string; file: string}>}) {
  const {slug, file} = await params;
  return privateVisualResponse(slug, file, {
    session: createClient,
    storage: () => {
      const env = process.env;
      const expected = env.VERCEL_ENV === 'production' ? 'https://ptrnjzmcehrhbsfxntgw.supabase.co'
        : env.VERCEL_ENV === 'preview' ? 'https://senonkpxdtlhyhrubicg.supabase.co' : null;
      if (!expected || env.NEXT_PUBLIC_SUPABASE_URL !== expected || !env.SUPABASE_SERVICE_ROLE_KEY) {
        throw new Error('Private visual storage unavailable');
      }
      return createStorageClient(expected, env.SUPABASE_SERVICE_ROLE_KEY, {
        auth: {persistSession: false, autoRefreshToken: false},
        global: {fetch: (input, init) => fetch(input, {...init, cache: 'no-store'})},
      });
    },
  });
}
