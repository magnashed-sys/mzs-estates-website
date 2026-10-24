import {timingSafeEqual} from 'node:crypto';
import {NextRequest,NextResponse} from 'next/server';
import {deliverVisitorReport} from '../../../lib/mzs/visitor-delivery';
export const runtime='nodejs';
export const maxDuration=60;
export async function GET(request:NextRequest) {
  const secret=process.env.CRON_SECRET;
  const actual=Buffer.from(request.headers.get('authorization')||'');
  const expected=Buffer.from('Bearer '+(secret||''));
  const reply=(status:number,result:string)=>NextResponse.json({status:result},{status,headers:{'Cache-Control':'no-store'}});
  if(!secret||actual.length!==expected.length||!timingSafeEqual(actual,expected))return reply(401,'unauthorized');
  try {
    const result=await deliverVisitorReport();
    return reply(['not_configured','recipient_requires_review','uncertain','failed'].includes(result)?503:200,result);
  } catch {return reply(503,'report_requires_review');}
}
