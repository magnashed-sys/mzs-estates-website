"use client";
import {Analytics, type BeforeSendEvent} from '@vercel/analytics/next';
import {usePathname} from 'next/navigation';
import {analyticsPage, cleanLocation} from '../../lib/analytics/public';
function onlyPublicPageviews(event:BeforeSendEvent):BeforeSendEvent|null {
 const url = cleanLocation(event.url);
 return event.type === 'pageview' && url ? {...event,url} : null;
}
export default function PublicWebAnalytics() {
 const pathname=usePathname();
 return pathname && analyticsPage(pathname) ? <Analytics beforeSend={onlyPublicPageviews}/> : null;
}
