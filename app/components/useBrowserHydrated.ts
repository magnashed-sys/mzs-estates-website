'use client';
import {useSyncExternalStore} from 'react';
const subscribe = () => () => {};
const clientSnapshot = () => true;
const serverSnapshot = () => false;

/** Keep Intl-dependent labels identical during SSR and the first hydration pass. */
export function useBrowserHydrated() {
  return useSyncExternalStore(subscribe, clientSnapshot, serverSnapshot);
}
