import {NextResponse} from 'next/server';
import {requirePdfAdmin} from '../../../../../../lib/accountancy/pdf/server';
import {checkMailbox} from '../../../../../../scripts/check-mase-mailbox.mjs';
export const runtime='nodejs';
export const maxDuration=30;
export async function POST(req:Request){
 await requirePdfAdmin();
 const url=new URL(req.url);
 if(req.headers.get('origin')!==url.origin){
  return NextResponse.json({error:'Invalid origin'},{status:403,headers:{'Cache-Control':'private, no-store'}});
 }
 const result=await checkMailbox() as {ok:boolean;stage:string;code:string};
 const destination=new URL('/admin/workspaces/accountancy/purchases/mailbox',url);
 destination.searchParams.set('result',result.code);
 const response=NextResponse.redirect(destination,303);
 response.headers.set('Cache-Control','private, no-store');
 return response;
}
