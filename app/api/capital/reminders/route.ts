import {timingSafeEqual} from 'node:crypto';
import {NextRequest,NextResponse} from 'next/server';
import {deliverCapitalReminders} from '../../../../lib/capital/payment-reminder-delivery';
export const runtime = 'nodejs';
export const maxDuration = 60;
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const actual = Buffer.from(request.headers.get('authorization') || '');
  const expected = Buffer.from('Bearer ' + (secret || ''));
  const reply = (status: number, body: object) => NextResponse.json(body, {status, headers: {'Cache-Control': 'no-store'}});
  if (!secret || actual.length !== expected.length || !timingSafeEqual(actual,expected)) return reply(401, {status: 'unauthorized'});
  try {
    const result = await deliverCapitalReminders();
    return reply(['not_configured','requires_review'].includes(result.status) ? 503 : 200, result);
  } catch {return reply(503, {status: 'requires_review'});}
}
