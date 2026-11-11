import {createHash} from 'node:crypto';
import type {SupabaseClient} from '@supabase/supabase-js';
import {florawegPrivateAssets} from './floraweg-private-assets';

export const PRIVATE_VISUAL_BUCKET = 'mzs-private-project-visuals';
const headers = {
  'Cache-Control': 'private, no-store, max-age=0',
  'CDN-Cache-Control': 'no-store',
  'Vercel-CDN-Cache-Control': 'no-store',
  'Vary': 'Cookie',
  'X-Content-Type-Options': 'nosniff',
  'X-Robots-Tag': 'noindex, noimageindex',
  'Cross-Origin-Resource-Policy': 'same-origin',
  'Referrer-Policy': 'no-referrer',
};

type Dependencies = {
  session: () => Promise<SupabaseClient>;
  storage: () => SupabaseClient;
};

/** Every request repeats the project page's live authorization checks. Never signs a URL. */
export async function privateVisualResponse(slug: string, file: string, deps: Dependencies) {
  const fail = (status: number) => new Response(null, {status, headers});
  if (slug !== 'amsterdam-floraweg' || !Object.hasOwn(florawegPrivateAssets, file)) return fail(404);
  const asset = florawegPrivateAssets[file];
  try {
    const db = await deps.session();
    const {data: auth, error: authError} = await db.auth.getUser();
    if (authError || !auth.user) return fail(401);
    const {data: profile, error: profileError} = await db.from('profiles')
      .select('role,is_active').eq('id', auth.user.id).single();
    if (profileError || !profile || profile.is_active !== true ||
        !['client', 'partner', 'admin'].includes(profile.role)) return fail(404);
    const {data: project, error: projectError} = await db.from('projects')
      .select('id').eq('slug', slug).eq('status', 'active').maybeSingle();
    if (projectError || !project) return fail(404);
    const {data: projectGrant, error: grantError} = await db.from('project_access')
      .select('project_id').eq('project_id', project.id).eq('user_id', auth.user.id).maybeSingle();
    if (grantError || !projectGrant) return fail(404);
    const {data: grants, error: offeringGrantError} = await db.from('offering_access')
      .select('offering_id').eq('user_id', auth.user.id);
    if (offeringGrantError || !grants?.length) return fail(404);
    const {data: offerings, error: offeringError} = await db.from('offerings')
      .select('id').eq('project_id', project.id).eq('status', 'active')
      .in('id', grants.map(g => g.offering_id)).limit(1);
    if (offeringError || !offerings?.length) return fail(404);

    // Service-only bucket: the browser cannot read it or mint shareable signed URLs.
    // Construct the privileged client only after all current user grants are verified.
    const {data: original, error: storageError} = await deps.storage().storage
      .from(PRIVATE_VISUAL_BUCKET).download(`${slug}/do-2026/${file}`, {}, {cache: 'no-store'});
    if (storageError || !original || original.size !== asset.bytes) return fail(404);
    const bytes = await original.arrayBuffer();
    if (createHash('sha256').update(new Uint8Array(bytes)).digest('hex') !== asset.sha256) return fail(404);
    return new Response(bytes, {headers: {...headers, 'Content-Type': 'image/webp', 'Content-Disposition': 'inline'}});
  } catch {
    return fail(503);
  }
}
