import {NextRequest,NextResponse} from 'next/server';
import {createClient as serviceClient} from '@supabase/supabase-js';
import {createClient} from '../../../lib/supabase/server';
import {visitorPath} from '../../../lib/mzs/visitor-report';
export const runtime='nodejs';
const reply=(status:number)=>new NextResponse(null,{status,headers:{'Cache-Control':'no-store'}});
export async function POST(request:NextRequest) {
  if(request.headers.get('origin')!==request.nextUrl.origin) return reply(403);
  const expected = process.env.VERCEL_ENV==='production'?'https://ptrnjzmcehrhbsfxntgw.supabase.co':process.env.VERCEL_ENV==='preview'?'https://senonkpxdtlhyhrubicg.supabase.co':null;
  if(!expected || process.env.NEXT_PUBLIC_SUPABASE_URL!==expected || !process.env.SUPABASE_SERVICE_ROLE_KEY) return reply(503);
  try {
    const raw=await request.text(); if(raw.length>1000) return reply(413);
    const body=JSON.parse(raw);
    if(!['login','page'].includes(body.kind) || !/^[0-9a-f-]{36}$/i.test(body.event_id)) return reply(400);
    const path=body.kind==='login'?'/login':visitorPath(body.path); if(!path)return reply(400);
    const db=await createClient();
    const {data:auth,error:authError}=await db.auth.getUser(); if(authError||!auth.user) return reply(401);
    const {data:profile,error:profileError}=await db.from('profiles').select('role,is_active').eq('id',auth.user.id).single();
    if(profileError||!profile?.is_active||!['client','partner','admin'].includes(profile.role))return reply(403);
    // Admin logins are shown separately by role; no admin browsing is collected.
    if(body.kind==='page'&&profile.role==='admin')return reply(204);
    if(path.startsWith('/private/projects/')) {
      const {data:project}=await db.from('projects').select('id').eq('slug',path.split('/').pop()).eq('status','active').maybeSingle();
      if(!project)return reply(403);
      const {data:grant}=await db.from('project_access').select('project_id').eq('project_id',project.id).eq('user_id',auth.user.id).maybeSingle();
      const {data:grants}=await db.from('offering_access').select('offering_id').eq('user_id',auth.user.id);
      if(!grant||!grants?.length)return reply(403);
      const {data:offers}=await db.from('offerings').select('id').eq('project_id',project.id).eq('status','active').in('id',grants.map(g=>g.offering_id));
      if(!offers?.length)return reply(403);
    }
    const {data:claims,error:claimsError}=await db.auth.getClaims();
    const session=claims?.claims?.session_id;
    if(claimsError||typeof session!=='string')return reply(401);
    const service=serviceClient(expected,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
    const {error}=await service.rpc('mzs_record_visitor_activity',{p_user:auth.user.id,p_session:session,p_event:body.event_id,p_kind:body.kind,p_path:path});
    return reply(error?503:204);
  } catch {return reply(400);}
}
