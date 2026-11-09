'use client';

import {SpeedInsights} from '@vercel/speed-insights/next';
import type {ComponentProps} from 'react';
import {usePathname} from 'next/navigation';
import {analyticsPage, cleanLocation} from '../../lib/analytics/public';

type VitalEvent = Parameters<NonNullable<ComponentProps<typeof SpeedInsights>['beforeSend']>>[0];

export function onlyPublicVitals(event: VitalEvent): VitalEvent | null {
  const url = cleanLocation(event.url);
  // The SDK script can survive a client navigation after this component unmounts.
  // Check the current location at send time as well as the measured page.
  if (event.type !== 'vital' || !url || typeof window === 'undefined' || !cleanLocation(window.location.href)) return null;
  // Rebuild the route from the allowed URL: never forward search values or a
  // stale/private route supplied by the SDK during client navigation.
  return {type: 'vital', url, route: new URL(url).pathname};
}

export default function PublicSpeedInsights({enabled}: {enabled: boolean}) {
  const pathname = usePathname();
  if (!enabled || !pathname || !analyticsPage(pathname)) return null;
  return <SpeedInsights beforeSend={onlyPublicVitals} debug={false} />;
}
