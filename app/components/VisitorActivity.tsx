"use client";
import {useEffect} from 'react';
import {usePathname} from 'next/navigation';
import {createClient} from '../../lib/supabase/client';
import {visitorPath} from '../../lib/mzs/visitor-report';

/** First-party authenticated telemetry only; no third-party analytics or stored token. */
export default function VisitorActivity() {
  const pathname = usePathname();
  useEffect(()=>{
    if (!visitorPath(pathname)) return;
    let cancelled = false;
    const timer = setTimeout(async()=>{
      if(document.visibilityState !== 'visible') return;
      const {data} = await createClient().auth.getSession();
      if(cancelled || !data.session) return;
      void fetch('/api/visitor-activity',{method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({kind:'page',path:pathname,event_id:crypto.randomUUID()}),keepalive:true}).catch(()=>{});
    },800);
    return ()=>{cancelled=true;clearTimeout(timer);};
  },[pathname]);
  return null;
}
